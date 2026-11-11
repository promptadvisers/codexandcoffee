import Foundation
import Darwin

// stdout belongs solely to the helper's NDJSON protocol. Never forward raw child stderr.
final class HelperBridge {
    private var process: Process?
    let backend: String
    init(backend: String) { self.backend = backend }
    var available: Bool { FileManager.default.fileExists(atPath: backend) }
    func cancel() {
        guard let child = process else { return }
        process = nil
        if child.isRunning { child.terminate() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if child.isRunning { kill(child.processIdentifier, SIGKILL) }
        }
    }
    func call(_ payload: [String: Any], progress: @escaping ([String: Any]) -> Void, completion: @escaping ([String: Any]) -> Void) {
        guard available else { completion(["ok": false, "error": "backend.py is missing; check RELAY_BACKEND_PATH."]); return }
        let child = Process(), input = Pipe(), output = Pipe(), events = Pipe()
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin")
        env["RELAY_PROGRESS"] = "1"
        if let executable = env["RELAY_BACKEND_EXECUTABLE"], FileManager.default.isExecutableFile(atPath: executable) {
            child.executableURL = URL(fileURLWithPath: executable); child.arguments = []
        } else if let python = env["RELAY_PYTHON"], python.hasPrefix("/") {
            child.executableURL = URL(fileURLWithPath: python); child.arguments = [backend]
        } else {
            child.executableURL = URL(fileURLWithPath: "/usr/bin/env"); child.arguments = ["python3", backend]
        }
        child.environment = env
        child.standardInput = input; child.standardOutput = output; child.standardError = events
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { completion(["ok": false, "error": "Invalid backend request."]); return }
        do { try child.run() } catch { completion(["ok": false, "error": "Cannot start Python 3; configure RELAY_PYTHON."]); return }
        process = child
        DispatchQueue.global().async {
            var buffer = Data()
            while true {
                let data = events.fileHandleForReading.availableData
                if data.isEmpty { break }
                buffer.append(data)
                while let end = buffer.firstIndex(of: 10) {
                    let line = buffer[..<end]; buffer.removeSubrange(...end)
                    if let event = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any], event["type"] as? String == "tool" {
                        DispatchQueue.main.async { progress(event) }
                    }
                }
                if buffer.count > 65536 { buffer.removeAll() }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 150) { [weak self] in
            guard let self = self, self.process === child else { return }
            self.cancel(); completion(["ok": false, "error": "Request timed out after 150 seconds."])
        }
        DispatchQueue.global().async {
            try? input.fileHandleForWriting.write(contentsOf: data)
            try? input.fileHandleForWriting.close()
            var result = Data(), oversized = false
            while true {
                let chunk = output.fileHandleForReading.availableData
                if chunk.isEmpty { break }
                if result.count + chunk.count <= 4 * 1024 * 1024 { result.append(chunk) } else { oversized = true }
            }
            child.waitUntilExit()
            let response = !oversized ? (try? JSONSerialization.jsonObject(with: result)) as? [String: Any] : nil
            DispatchQueue.main.async { [weak self] in
                guard let self = self, self.process === child else { return }
                self.process = nil
                completion(response ?? ["ok": false, "error": "Backend returned an invalid response."])
            }
        }
    }
}

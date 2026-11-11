import AppKit
import AVFoundation
import ApplicationServices
import Carbon
import Darwin

private func helperHotKey(_: EventHandlerCallRef?, _ event: EventRef?, _ context: UnsafeMutableRawPointer?) -> OSStatus {
    guard let context = context, let event = event else { return OSStatus(eventNotHandledErr) }
    var id = EventHotKeyID()
    GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
    let helper = Unmanaged<ElectronHelper>.fromOpaque(context).takeUnretainedValue()
    if id.id == 2 {
        if GetEventKind(event) == UInt32(kEventHotKeyPressed) { helper.cancel("escape") }
    }
    return noErr
}

final class ElectronHelper: NSObject, NSApplicationDelegate, AVAudioRecorderDelegate {
    private var state = HoldState()
    private var escape: EventHotKeyRef?, handler: EventHandlerRef?
    private var optionTrigger = OptionHoldTrigger()
    private var shortcutReady = false
    private var recorder: AVAudioRecorder?, audio: URL?, tick: Timer?
    private var target: AXUIElement?, targetPID: pid_t?
    private var focusTracker = HelperFocusTracker(), lastFocusCheck: TimeInterval = 0
    private var focusLost: Bool { focusTracker.lost }
    private var pasteCommitted = false
    private var insertionDetails: [String: Any] = [:]
    private var voiceTiming: [String: Int] = [:]
    private var voiceReleasedAt: TimeInterval?
    private var lastText = "", requestText = "", requestID = "", mode = "dictate"
    private var toolEvents: [[String: Any]] = [], history: [[String: Any]] = []
    private var settings: [String: Any] = ["account": "primary", "model": "", "voice_mode": "auto"]
    private let bridge: HelperBridge
    private let dataDirectory: URL
    private var signalSources: [DispatchSourceSignal] = []
    private var shuttingDown = false
    private let noShortcuts = CommandLine.arguments.contains("--no-shortcuts") || ProcessInfo.processInfo.environment["RELAY_NO_SHORTCUTS"] == "1"
    private var now: TimeInterval { ProcessInfo.processInfo.systemUptime }

    override init() {
        let env = ProcessInfo.processInfo.environment
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
        bridge = HelperBridge(backend: env["RELAY_BACKEND_PATH"] ?? executable.deletingLastPathComponent().appendingPathComponent("backend.py").path)
        dataDirectory = env["RELAY_DATA_DIR"].map { URL(fileURLWithPath: $0) } ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Relay Voice")
        super.init()
        if let saved = read("settings.json") as? [String: Any] {
            if let account = saved["account"] as? String, ["primary", "work", "personal"].contains(account) { settings["account"] = account }
            if let model = saved["model"] as? String { settings["model"] = model }
            // All saved modes migrate to the single voice input.
        }
        history = Array(((read("helper-history.json") as? [[String: Any]]) ?? []).prefix(100))
    }
    private func read(_ name: String) -> Any? {
        guard let data = try? Data(contentsOf: dataDirectory.appendingPathComponent(name)) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }
    @discardableResult private func save(_ name: String, _ value: Any) -> Bool {
        do {
            try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            let file = dataDirectory.appendingPathComponent(name)
            try JSONSerialization.data(withJSONObject: value).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            return true
        } catch { emit("warning", ["code": "storage", "message": "Local settings or history could not be saved."]); return false }
    }
    private func emit(_ event: String, _ fields: [String: Any] = [:]) {
        var envelope = fields
        envelope["event"] = event; envelope["v"] = 1
        guard let data = try? JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys]) else { return }
        do { try FileHandle.standardOutput.write(contentsOf: data + Data([10])) } catch { shutdown() }
    }
    private func reply(_ id: String, _ ok: Bool = true, _ fields: [String: Any] = [:]) {
        var result = fields; result["id"] = id; result["ok"] = ok; emit("response", result)
    }
    private func publishState(_ reason: String = "") {
        emit("state", ["state": state.phase.rawValue, "request_id": requestID, "reason": reason, "mode": mode])
        watchEscape(state.phase != .idle && !pasteCommitted)
    }
    private func permissions() -> [String: Any] {
        let mic: String
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: mic = "authorized"
        case .notDetermined: mic = "not_determined"
        case .restricted: mic = "restricted"
        default: mic = "denied"
        }
        return ["microphone": mic, "accessibility": AXIsProcessTrusted(), "shortcut": shortcutReady, "backend": bridge.available]
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.prohibited)
        if !noShortcuts {
            var types = [EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)), EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased))]
            let installed = InstallEventHandler(GetApplicationEventTarget(), helperHotKey, types.count, &types, Unmanaged.passUnretained(self).toOpaque(), &handler)
            shortcutReady = installed == noErr
            optionTrigger = OptionHoldTrigger(initiallyDown: physicallyHeld())
        }
        // Read only current key state. No event suppression, text capture or input injection.
        // Polling also observes releases while the system microphone prompt is open.
        tick = Timer(timeInterval: 0.02, repeats: true) { [weak self] _ in self?.tickAction() }
        RunLoop.main.add(tick!, forMode: .common)
        for sig in [SIGTERM, SIGINT] {
            signal(sig, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            source.setEventHandler { [weak self] in self?.shutdown() }; source.resume(); signalSources.append(source)
        }
        emit("ready", ["protocol": "relay-helper/1", "permissions": permissions(), "settings": settings, "capabilities": ["hold_to_record", "meter", "ask", "tool_progress", "history", "ax_insert", "copy"], "draft_writes": false])
        if !shortcutReady && !noShortcuts { emit("error", ["code": "shortcut_unavailable", "message": "The Option-key listener could not start. Restart Relay Voice."]) }
        publishState()
        readCommands()
    }
    private func readCommands() {
        DispatchQueue.global().async { [weak self] in
            var buffer = Data(), discarding = false
            while true {
                let chunk = FileHandle.standardInput.availableData
                if chunk.isEmpty { DispatchQueue.main.async { self?.shutdown() }; return }
                for byte in chunk {
                    if byte == 10 {
                        if !discarding {
                            let line = buffer
                            DispatchQueue.main.async { self?.command(line) }
                        }
                        buffer.removeAll(keepingCapacity: true); discarding = false
                    } else if !discarding {
                        buffer.append(byte)
                        if buffer.count > 1024 * 1024 {
                            buffer.removeAll(); discarding = true
                            DispatchQueue.main.async { self?.emit("error", ["code": "command_too_large", "message": "Command exceeds 1 MiB."]) }
                        }
                    }
                }
            }
        }
    }
    private func command(_ data: Data) {
        guard let c = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let action = c["command"] as? String, let id = c["id"] as? String, !id.isEmpty else {
            emit("error", ["code": "invalid_command", "message": "Expected JSON object with string id and command."]); return
        }
        switch action {
        case "ping": reply(id, true, ["state": state.phase.rawValue])
        case "permissions": reply(id, true, ["permissions": permissions()])
        case "request_accessibility":
            let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
            _ = AXIsProcessTrustedWithOptions(options)
            reply(id, true, ["permissions": permissions()])
        case "request_microphone":
            guard state.phase == .idle else { reply(id, false, ["error": "Busy."]); return }
            // Setup only; this callback can never arm recording or insertion.
            AVCaptureDevice.requestAccess(for: .audio) { [weak self] _ in DispatchQueue.main.async { guard let self = self else { return }; self.reply(id, true, ["permissions": self.permissions()]) } }
        case "settings_get": reply(id, true, ["settings": settings])
        case "settings_set":
            guard state.phase == .idle else { reply(id, false, ["error": "Busy."]); return }
            guard let value = c["settings"] as? [String: Any], let account = value["account"] as? String, ["primary", "work", "personal"].contains(account), let model = value["model"] as? String, model.count <= 120, let mode = value["voice_mode"] as? String, ["auto", "dictate", "ask"].contains(mode) else { reply(id, false, ["error": "Expected account, model and voice_mode."]); return }
            let next: [String: Any] = ["account": account, "model": model, "voice_mode": "auto"]
            if save("settings.json", next) { settings = next; reply(id, true, ["settings": settings]) } else { reply(id, false, ["error": "Settings could not be saved."]) }
        case "test_insertion":
            guard Set(c.keys) == Set(["id", "command"]) else { reply(id, false, ["error": "Test text is fixed."]); return }
            guard AXIsProcessTrusted() else { reply(id, false, ["error": "Enable Accessibility first."]); return }
            guard let token = state.begin(.inserting) else { reply(id, false, ["error": "Busy."]); return }
            requestID = id; voiceTiming = [:]; voiceReleasedAt = nil; mode = "dictate"; pasteCommitted = false; insertionDetails = [:]
            target = nil; targetPID = nil; toolEvents = []; lastText = "Relay insertion test."; requestText = lastText
            reply(id, true, ["accepted": true]); testInsertionCountdown(8, token: token)
        case "history_get": reply(id, true, ["entries": history])
        case "history_clear": history = []; reply(id, save("helper-history.json", history)); emit("history", ["entries": history])
        case "cancel": cancel("command"); reply(id)
        case "ask":
            guard let text = c["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.count <= 30000 else { reply(id, false, ["error": "Ask requires 1–30000 characters."]); return }
            guard state.begin(.asking) != nil else { reply(id, false, ["error": "Busy."]); return }
            requestID = id; voiceTiming = [:]; voiceReleasedAt = nil; target = nil; targetPID = nil; focusTracker = HelperFocusTracker(); pasteCommitted = false; insertionDetails = [:]; mode = "ask"; lastText = ""
            reply(id, true, ["accepted": true]); ask(text)
        case "status":
            guard state.begin(.status) != nil else { reply(id, false, ["error": "Busy."]); return }
            requestID = id; voiceTiming = [:]; voiceReleasedAt = nil; let token = state.generation; publishState()
            bridge.call(["action": "status"], progress: { _ in }) { [weak self] response in
                guard let self = self, self.state.accepts(token) else { return }
                self.reply(id, response["ok"] as? Bool == true, ["result": response, "permissions": self.permissions()]); self.state.finish(); self.publishState()
            }
        case "copy":
            guard !lastText.isEmpty else { reply(id, false, ["error": "No result to copy."]); return }
            NSPasteboard.general.clearContents(); let copied = NSPasteboard.general.setString(lastText, forType: .string)
            reply(id, copied)
        case "shutdown": reply(id); shutdown()
        default: reply(id, false, ["error": "Unsupported command. Draft writes and sends are disabled."])
        }
    }
    private func physicallyHeld() -> Bool {
        CGEventSource.keyState(.combinedSessionState, key: CGKeyCode(kVK_Option)) || CGEventSource.keyState(.combinedSessionState, key: CGKeyCode(kVK_RightOption))
    }
    private func tickAction() {
        if shortcutReady && !noShortcuts {
            let optionDown = physicallyHeld()
            let modifiers = NSEvent.modifierFlags.intersection([.command, .control, .shift, .function])
            let modifierCodes: Set<CGKeyCode> = [54, 55, 56, 57, 58, 59, 60, 61, 62, 63]
            let otherKey = optionDown && ((state.phase != .idle && !state.held) || !modifiers.isEmpty || (0..<128).contains { code in
                !modifierCodes.contains(CGKeyCode(code)) && CGEventSource.keyState(.combinedSessionState, key: CGKeyCode(code))
            })
            switch optionTrigger.update(optionDown: optionDown, otherKeyDown: otherKey, now: now) {
            case .press: press()
            case .release: release()
            case .cancel: if state.phase == .recording || state.phase == .permission { cancel("option_chord") }
            case .none: break
            }
        }
        if state.phase != .idle && target != nil && !focusLost {
            // The cheap app check runs each tick; cross-process AX reads are throttled.
            if let front = NSWorkspace.shared.frontmostApplication?.processIdentifier, front != targetPID { focusTracker.observe(.moved) }
            else if now - lastFocusCheck >= 0.2 {
                lastFocusCheck = now; focusTracker.observe(targetFocus())
            }
        }
        if let recorder = recorder {
            recorder.updateMeters()
            let db = recorder.averagePower(forChannel: 0)
            emit("meter", ["request_id": requestID, "db": max(-160, min(0, db)), "level": max(0, min(1, pow(10, db / 40))), "elapsed_ms": Int((now - state.started) * 1000)])
            if now - state.started >= 120 { cancel("recording_limit") }
        }
    }
    func press() {
        guard let token = state.press() else { return }
        requestID = UUID().uuidString; mode = "auto"; pasteCommitted = false; insertionDetails = [:]; voiceTiming = [:]; voiceReleasedAt = nil
        lastText = ""; requestText = ""; toolEvents = []; captureTarget(); publishState()
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        if status == .authorized { permission(token, granted: true) }
        else if status == .notDetermined {
            AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in DispatchQueue.main.async { self?.permission(token, granted: granted) } }
        } else { permission(token, granted: false) }
    }
    private func permission(_ token: Int, granted: Bool) {
        // Never start recording after Option was released during the system dialog.
        if state.held && !physicallyHeld() { release() }
        guard state.permission(token, granted: granted, now: now) else {
            if token == state.generation && !granted { emit("error", ["code": "microphone", "message": "Enable microphone access in System Settings.", "request_id": requestID]); publishState("microphone_denied") }
            return
        }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("relay-helper-\(UUID().uuidString)")
        let url = directory.appendingPathComponent("capture.m4a")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700]); audio = url
            let recorder = try AVAudioRecorder(url: url, settings: [AVFormatIDKey: Int(kAudioFormatMPEG4AAC), AVSampleRateKey: 16000, AVNumberOfChannelsKey: 1, AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue])
            recorder.delegate = self; recorder.isMeteringEnabled = true
            guard recorder.record() else { throw NSError(domain: "Relay", code: 1) }
            self.recorder = recorder; publishState()
        } catch { fail("Microphone recording could not start.") }
    }
    func release() {
        switch state.release(now: now) {
        case .ignored: return
        case .abandonPermission: target = nil; targetPID = nil; publishState("released_during_permission")
        case .discard: cleanupAudio(); target = nil; targetPID = nil; publishState("short_tap")
        case .transcribe:
            let releasedAt = now
            voiceReleasedAt = releasedAt
            recorder?.stop(); recorder = nil
            guard let audio = audio else { fail("Recording is unavailable."); return }
            publishState(); let token = state.generation
            let bridgeStarted = now
            voiceTiming["recording_finalize"] = Int((bridgeStarted - releasedAt) * 1000)
            bridge.call(payload(["action": "transcribe", "audio_path": audio.path, "smart": true]), progress: { _ in }) { [weak self] response in
                guard let self = self, self.state.accepts(token) else { return }
                self.voiceTiming["transcription_bridge"] = Int((self.now - bridgeStarted) * 1000)
                if let measured = response["timing_ms"] as? [String: Int] {
                    for (key, value) in measured { self.voiceTiming[key] = value }
                }
                self.cleanupAudio()
                guard response["ok"] as? Bool == true else { self.fail(response["error"] as? String ?? "Transcription failed."); return }
                guard let text = response["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { self.fail("No speech was transcribed."); return }
                self.emit("transcript", ["request_id": self.requestID, "text": text])
                self.mode = response["intent"] as? String == "ask" ? "ask" : "dictate"
                if self.mode == "ask" { self.state.transition(.asking); self.ask(text) }
                else {
                    self.lastText = text; self.requestText = text
                    let insertionStarted = self.now
                    self.insert(text) { [weak self] insertion in
                        guard let self = self, self.state.accepts(token) else { return }
                        self.voiceTiming["insertion_and_verification"] = Int((self.now - insertionStarted) * 1000)
                        self.voiceTiming["release_to_complete"] = Int((self.now - releasedAt) * 1000)
                        self.emit("result", ["request_id": self.requestID, "kind": "dictation", "result": response, "insertion": insertion, "insertion_details": self.insertionDetails])
                        self.remember("dictation", response: response, outcome: insertion)
                        self.state.finish(); self.publishState()
                    }
                }
            }
        }
    }
    private func payload(_ input: [String: Any]) -> [String: Any] {
        var p = input
        if let model = settings["model"] as? String, !model.isEmpty { p["model"] = model }
        return p
    }
    private func ask(_ text: String) {
        // Tool answers belong in Relay's result window. Only dictation inserts.
        target = nil; targetPID = nil
        requestText = text; toolEvents = []; publishState()
        let token = state.generation
        bridge.call(payload(["action": "ask", "text": text, "account": settings["account"] ?? "primary"]), progress: { [weak self] event in
            guard let self = self, self.state.accepts(token) else { return }
            if let index = self.toolEvents.firstIndex(where: { $0["id"] as? String == event["id"] as? String }) { self.toolEvents[index] = event } else { self.toolEvents.append(event) }
            self.emit("tool", ["request_id": self.requestID, "tool": event])
        }) { [weak self] response in
            guard let self = self, self.state.accepts(token) else { return }
            if let events = response["tool_events"] as? [[String: Any]] { self.toolEvents = events }
            guard response["ok"] as? Bool == true else { self.fail(response["error"] as? String ?? "Ask failed."); return }
            self.lastText = response["text"] as? String ?? ""
            self.emit("result", ["request_id": self.requestID, "kind": "ask", "result": response, "insertion": "not_requested", "insertion_details": self.insertionDetails])
            self.remember("ask", response: response, outcome: "answered")
            self.state.finish(); self.publishState()
        }
    }
    private func remember(_ kind: String, response: [String: Any], outcome: String) {
        let entry: [String: Any] = ["id": requestID, "date": ISO8601DateFormatter().string(from: Date()), "kind": kind, "request": requestText, "result": response, "outcome": outcome, "tools": toolEvents, "insertion_details": insertionDetails, "timing_ms": voiceTiming]
        history.insert(entry, at: 0); history = Array(history.prefix(100)); save("helper-history.json", history)
        emit("history_entry", ["entry": entry])
    }
    private func fail(_ message: String) {
        for index in toolEvents.indices where toolEvents[index]["status"] as? String == "running" { toolEvents[index]["status"] = "failed" }
        cleanupAudio(); emit("error", ["request_id": requestID, "code": "operation_failed", "message": message])
        remember(mode, response: ["ok": false, "error": message], outcome: "failed")
        state.cancel(); target = nil; targetPID = nil; publishState("failed")
    }
    func cancel(_ reason: String) {
        guard state.phase != .idle else { return }
        // A posted paste cannot be undone. Let verification finish and never claim
        // “No text inserted” after committing the input event.
        guard HelperPasteVerification.canCancel(pasteCommitted: pasteCommitted) else { return }
        state.cancel(); bridge.cancel(); cleanupAudio()
        for index in toolEvents.indices where toolEvents[index]["status"] as? String == "running" { toolEvents[index]["status"] = "cancelled" }
        remember(mode, response: ["ok": false, "error": "Cancelled."], outcome: "cancelled")
        target = nil; targetPID = nil; emit("cancelled", ["request_id": requestID, "reason": reason]); publishState(reason)
    }
    private func cleanupAudio() {
        recorder?.stop(); recorder = nil
        if let audio = audio { try? FileManager.default.removeItem(at: audio.deletingLastPathComponent()) }
        audio = nil
    }
    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) { fail("Audio recording failed.") }
    private func watchEscape(_ active: Bool) {
        if !active, let key = escape { UnregisterEventHotKey(key); escape = nil }
        if active && escape == nil && !noShortcuts {
            if RegisterEventHotKey(UInt32(kVK_Escape), 0, EventHotKeyID(signature: 0x524C5948, id: 2), GetApplicationEventTarget(), 0, &escape) != noErr {
                emit("warning", ["code": "escape_unavailable", "message": "Escape is unavailable; use Cancel."])
            }
        }
    }
    private func focused(_ pid: pid_t) -> AXUIElement? {
        var value: CFTypeRef?
        let app = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(app, 0.05)
        guard AXUIElementCopyAttributeValue(app, kAXFocusedUIElementAttribute as CFString, &value) == .success, let value = value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        let element = value as! AXUIElement
        AXUIElementSetMessagingTimeout(element, 0.05)
        return element
    }
    private func eligible(_ element: AXUIElement) -> Bool {
        var role: CFTypeRef?, subrole: CFTypeRef?, protected: CFTypeRef?, enabled: CFTypeRef?
        guard !IsSecureEventInputEnabled(), AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role) == .success else { return false }
        _ = AXUIElementCopyAttributeValue(element, kAXSubroleAttribute as CFString, &subrole)
        _ = AXUIElementCopyAttributeValue(element, "AXProtectedContent" as CFString, &protected)
        _ = AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabled)
        return HelperTargetPolicy.eligible(role: role as? String, subrole: subrole as? String, protected: (protected as? Bool) == true, enabled: (enabled as? Bool) != false)
    }
    private func captureTarget() {
        target = nil; targetPID = nil; focusTracker = HelperFocusTracker(); lastFocusCheck = now
        guard AXIsProcessTrusted(), let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != getpid(), app.processIdentifier != getppid(), !app.isTerminated, let element = focused(app.processIdentifier), eligible(element) else { return }
        AXUIElementSetMessagingTimeout(element, 0.05)
        target = element; targetPID = app.processIdentifier
    }
    private func targetFocus() -> HelperFocusObservation {
        guard let target = target, let pid = targetPID else { return .unavailable }
        guard let front = NSWorkspace.shared.frontmostApplication?.processIdentifier else { return .unavailable }
        guard front == pid else { return .moved }
        guard let current = focused(pid) else { return .unavailable }
        return CFEqual(current, target) ? .same : .moved
    }
    private func targetStillFocused() -> Bool { targetFocus() == .same }
    private func testInsertionCountdown(_ seconds: Int, token: Int) {
        guard state.accepts(token) else { return }
        if seconds > 0 {
            publishState("test_countdown_\(seconds)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.testInsertionCountdown(seconds - 1, token: token) }
            return
        }
        captureTarget()
        insert(lastText) { [weak self] outcome in
            guard let self = self, self.state.accepts(token) else { return }
            let result: [String: Any] = ["ok": true, "text": self.lastText, "sources": [], "diagnostic": true]
            self.emit("result", ["request_id": self.requestID, "kind": "insertion_test", "result": result, "insertion": outcome, "insertion_details": self.insertionDetails])
            self.remember("insertion_test", response: result, outcome: outcome)
            self.state.finish(); self.publishState()
        }
    }
    private func fieldValue(_ element: AXUIElement) -> String? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &value) == .success,
              let text = value as? String, text.utf16.count <= 1_000_000 else { return nil }
        return text
    }
    private func selection(_ element: AXUIElement) -> NSRange? {
        var raw: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &raw) == .success,
              let raw = raw, CFGetTypeID(raw) == AXValueGetTypeID() else { return nil }
        let value = raw as! AXValue
        var range = CFRange()
        guard AXValueGetType(value) == .cfRange, AXValueGetValue(value, .cfRange, &range) else { return nil }
        return NSRange(location: range.location, length: range.length)
    }
    private func insert(_ text: String, completion: @escaping (String) -> Void) {
        state.transition(.inserting); publishState()
        awaitInsertion(text, token: state.generation, deadline: now + 1.5, completion: completion)
    }
    private func awaitInsertion(_ text: String, token: Int, deadline: TimeInterval, completion: @escaping (String) -> Void) {
        guard state.accepts(token) else { return }
        guard AXIsProcessTrusted() else { completion("accessibility_required"); return }
        guard target != nil, targetPID != nil else { completion("no_eligible_target"); return }
        let focus = targetFocus(); focusTracker.observe(focus)
        guard !focusLost else { completion("focus_changed"); return }
        let modifiersHeld = !NSEvent.modifierFlags.intersection([.option, .command, .control, .shift]).isEmpty
        if modifiersHeld || focus == .unavailable {
            if now >= deadline {
                insertionDetails = ["reason": modifiersHeld ? "modifiers_held" : "focus_unavailable"]
                completion(modifiersHeld ? "modifiers_held" : "focus_unavailable"); return
            }
            publishState(modifiersHeld ? "waiting_for_keys" : "waiting_for_field")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.awaitInsertion(text, token: token, deadline: deadline, completion: completion)
            }
            return
        }
        commitPaste(text, token: token, completion: completion)
    }
    private func commitPaste(_ text: String, token: Int, completion: @escaping (String) -> Void) {
        guard let target = target, let pid = targetPID, state.accepts(token) else { return }
        guard eligible(target) else { completion("target_not_safe"); return }
        let before = fieldValue(target), range = selection(target)
        let expected = before.flatMap { value in range.flatMap { HelperTextEdit.replacing(value: value, location: $0.location, length: $0.length, text: text)?.value } }
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(kVK_ANSI_V), keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(kVK_ANSI_V), keyDown: false) else { completion("copy_required"); return }
        let pasteboard = NSPasteboard.general
        let snapshot: [[NSPasteboard.PasteboardType: Data]] = pasteboard.pasteboardItems?.map { item in
            Dictionary(uniqueKeysWithValues: item.types.compactMap { type in item.data(forType: type).map { (type, $0) } })
        } ?? []
        guard !focusLost, targetStillFocused(), eligible(target), fieldValue(target) == before,
              selection(target) == range else { completion("focus_or_value_changed"); return }
        guard NSEvent.modifierFlags.intersection([.option, .command, .control, .shift]).isEmpty else { completion("modifiers_held"); return }
        pasteboard.clearContents()
        let wrote = pasteboard.setString(text, forType: .string), writeCount = pasteboard.changeCount
        let restore = {
            guard HelperPasteVerification.restoreClipboard(written: writeCount, current: pasteboard.changeCount) else { return }
            pasteboard.clearContents()
            let items = snapshot.map { saved -> NSPasteboardItem in
                let item = NSPasteboardItem()
                for (type, data) in saved { item.setData(data, forType: type) }
                return item
            }
            if !items.isEmpty { pasteboard.writeObjects(items) }
        }
        guard wrote else { restore(); completion("copy_required"); return }
        guard !focusLost, targetStillFocused(), eligible(target) else { restore(); completion("focus_changed"); return }
        pasteCommitted = true
        down.flags = .maskCommand; up.flags = .maskCommand
        down.postToPid(pid); up.postToPid(pid)
        if let released = voiceReleasedAt { voiceTiming["release_to_paste"] = Int((now - released) * 1000) }
        state.transition(.verifying); publishState()
        var monitor = HelperPasteMonitor(before: before, expected: expected, deadline: now + 2.5)
        func verify() {
            guard self.state.accepts(token) else { return }
            let focus = self.focusLost ? HelperFocusObservation.moved : self.targetFocus()
            let after = focus == .same && self.eligible(target) ? self.fieldValue(target) : nil
            let decision = monitor.observe(after: after, focus: focus, now: self.now)
            switch decision {
            case .wait:
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: verify)
            case .verified:
                // The editor consumed this clipboard. Only now is restoration safe.
                restore(); self.insertionDetails = ["reason": "verified", "after_utf16": after?.utf16.count ?? -1]
                self.pasteCommitted = false; completion("inserted_verified")
            case .unverified(let reason):
                // Keep the transcript on the clipboard for a possibly delayed paste.
                // A timed restore could paste the user's OLD clipboard into this field.
                self.insertionDetails = ["reason": reason, "before_utf16": before?.utf16.count ?? -1, "after_utf16": after?.utf16.count ?? -1]
                self.pasteCommitted = false; completion("paste_unverified")
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: verify)
    }

    private func shutdown() {
        guard !shuttingDown else { return }; shuttingDown = true
        state.cancel(); bridge.cancel(); cleanupAudio(); tick?.invalidate()
        if let key = escape { UnregisterEventHotKey(key) }
        NSApp.terminate(nil)
    }
}

@main enum ElectronHelperMain {
    static func main() {
        signal(SIGPIPE, SIG_IGN)
        let app = NSApplication.shared, helper = ElectronHelper()
        app.delegate = helper
        withExtendedLifetime(helper) { app.run() }
    }
}

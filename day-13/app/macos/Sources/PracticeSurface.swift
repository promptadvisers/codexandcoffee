import AppKit

final class PracticeView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        NSColor(calibratedRed: 0.94, green: 0.96, blue: 0.97, alpha: 1).setFill()
        bounds.fill()
        NSColor(calibratedRed: 0.14, green: 0.23, blue: 0.29, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: 55, y: bounds.height - 265, width: bounds.width - 110, height: 190), xRadius: 22, yRadius: 22).fill()
        let title = "A clear path from idea to result"
        title.draw(at: NSPoint(x: 85, y: bounds.height - 150), withAttributes: [.font: NSFont.systemFont(ofSize: 38, weight: .semibold), .foregroundColor: NSColor.white])
        "PRACTICE SURFACE  •  Fictional content for an annotation test".draw(at: NSPoint(x: 85, y: bounds.height - 210), withAttributes: [.font: NSFont.systemFont(ofSize: 18), .foregroundColor: NSColor.white])
        let cardWidth = (bounds.width - 150) / 3
        for (index, title) in ["1  Observe", "2  Build", "3  Verify"].enumerated() {
            let rect = NSRect(x: 55 + CGFloat(index) * (cardWidth + 20), y: 240, width: cardWidth, height: bounds.height - 545)
            NSColor.white.setFill()
            NSBezierPath(roundedRect: rect, xRadius: 18, yRadius: 18).fill()
            title.draw(at: NSPoint(x: rect.minX + 24, y: rect.maxY - 60), withAttributes: [.font: NSFont.systemFont(ofSize: 26, weight: .medium), .foregroundColor: NSColor.darkGray])
        }
    }
}
final class PracticeDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var counter: NSTextField!
    var clicks = 0
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let screen = NSScreen.main!
        window = NSWindow(contentRect: screen.visibleFrame, styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Practice Surface — fictional annotation test"
        window.appearance = NSAppearance(named: .aqua)
        window.setFrame(screen.visibleFrame, display: true)
        let view = PracticeView(frame: NSRect(origin: .zero, size: screen.visibleFrame.size))
        view.autoresizingMask = [.width, .height]
        window.contentView = view
        let button = NSButton(title: "Test underlying click", target: self, action: #selector(increment))
        button.frame = NSRect(x: 55, y: 125, width: 230, height: 44)
        button.bezelStyle = .rounded
        button.setAccessibilityIdentifier("fixtureClick")
        view.addSubview(button)
        counter = NSTextField(labelWithString: "Underlying clicks: 0")
        counter.font = .systemFont(ofSize: 22, weight: .semibold)
        counter.frame = NSRect(x: 315, y: 132, width: 300, height: 35)
        view.addSubview(counter)
        let input = NSTextField(string: "Edit this harmless text")
        input.frame = NSRect(x: 55, y: 62, width: 400, height: 36)
        input.font = .systemFont(ofSize: 20)
        input.setAccessibilityIdentifier("fixtureText")
        view.addSubview(input)
        let label = NSTextField(labelWithString: "Draw mode should block these controls. Interact mode should reach them.")
        label.frame = NSRect(x: 55, y: 18, width: 1000, height: 25)
        label.textColor = .darkGray
        view.addSubview(label)
        let menu = NSMenu()
        let item = NSMenuItem()
        menu.addItem(item)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Practice Surface", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.submenu = appMenu
        NSApp.mainMenu = menu
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    @objc func increment() {
        clicks += 1
        counter.stringValue = "Underlying clicks: \(clicks)"
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("StageInk", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("fixture-events.log")
        let data = "\(Date().ISO8601Format()) click \(clicks)\n".data(using: .utf8)!
        if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
        if let handle = try? FileHandle(forWritingTo: url) { _ = try? handle.seekToEnd(); try? handle.write(contentsOf: data); try? handle.close() }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}
let delegate = PracticeDelegate()
NSApplication.shared.delegate = delegate
NSApplication.shared.run()

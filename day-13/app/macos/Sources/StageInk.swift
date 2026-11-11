import AppKit
import Carbon

let featureStage = 4
let isComponentTest = Bundle.main.bundleIdentifier?.hasSuffix(".test") == true

// Release builds keep settings in the current user’s Application Support folder.
struct InkPoint: Codable { var x: Double; var y: Double
    var point: NSPoint { NSPoint(x: x, y: y) }
    init(_ point: NSPoint) { x = point.x; y = point.y }
}
struct Mark: Codable {
    var tool: String
    var color: Int
    var width: Double
    var points: [InkPoint]
}
struct SavedState: Codable {
    var tool = "Pen"
    var color = 0
    var width = 6.0
    var background = "Desktop"
    var canvases: [String: [Mark]] = [:]
}
let inkColors: [NSColor] = [.systemOrange, .systemBlue, .systemPink, .systemGreen, .systemYellow, .white, .black]
let colorNames = ["Orange", "Blue", "Pink", "Green", "Yellow", "White", "Black"]
let toolNames = featureStage >= 2 ? ["Pen", "Line", "Arrow", "Rectangle", "Ellipse"] : ["Pen"]

final class OverlayWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { isComponentTest }
}
final class Canvas: NSView {
    weak var owner: StageInkDelegate?
    var displayID = ""
    var draft: Mark?
    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }
    var canvasKey: String { displayID + "/" + (owner?.state.background ?? "Desktop") }
    override func resetCursorRects() { addCursorRect(bounds, cursor: .crosshair) }
    override func draw(_ rect: NSRect) {
        guard let owner else { return }
        let background = owner.state.background
        
        if background == "Whiteboard" { NSColor.white.setFill(); bounds.fill() }
        if background == "Blackboard" { NSColor(calibratedWhite: 0.07, alpha: 1).setFill(); bounds.fill() }
        for mark in owner.state.canvases[canvasKey, default: []] { paint(mark) }
        if let draft { paint(draft) }
        if owner.drawing {
            NSColor(calibratedWhite: 0.1, alpha: 0.9).setFill()
            NSBezierPath(roundedRect: NSRect(x: 15, y: 30, width: 300, height: 36), xRadius: 8, yRadius: 8).fill()
            "StageInk • DRAW • Escape to interact".draw(at: NSPoint(x: 28, y: 39), withAttributes: [.font: NSFont.systemFont(ofSize: 14, weight: .medium), .foregroundColor: NSColor.white])
        }
    }
    func paint(_ mark: Mark) {
        guard let start = mark.points.first?.point, let end = mark.points.last?.point else { return }
        inkColors[max(0, min(mark.color, inkColors.count - 1))].setStroke()
        let path = NSBezierPath()
        path.lineWidth = mark.width
        path.lineCapStyle = .round
        path.lineJoinStyle = .round
        let box = NSRect(x: min(start.x, end.x), y: min(start.y, end.y), width: abs(start.x-end.x), height: abs(start.y-end.y))
        switch mark.tool {
        case "Rectangle": path.appendRect(box)
        case "Ellipse": path.appendOval(in: box)
        case "Arrow":
            path.move(to: start); path.line(to: end)
            let angle = atan2(end.y-start.y, end.x-start.x)
            let length = max(16, mark.width * 3)
            for offset in [-0.5, 0.5] {
                path.move(to: end)
                path.line(to: NSPoint(x: end.x-length*cos(angle+offset), y: end.y-length*sin(angle+offset)))
            }
        case "Line": path.move(to: start); path.line(to: end)
        default:
            path.move(to: start)
            if mark.points.count == 1 { path.line(to: NSPoint(x: start.x + 0.1, y: start.y)) }
            for point in mark.points.dropFirst() { path.line(to: point.point) }
        }
        path.stroke()
    }
    override func mouseDown(with event: NSEvent) {
        guard let owner, owner.drawing else { return }
        window?.makeFirstResponder(self)
        draft = Mark(tool: owner.state.tool, color: owner.state.color, width: owner.state.width, points: [InkPoint(convert(event.locationInWindow, from: nil))])
        needsDisplay = true
    }
    override func mouseDragged(with event: NSEvent) {
        guard var mark = draft else { return }
        let point = InkPoint(convert(event.locationInWindow, from: nil))
        if mark.tool == "Pen" { mark.points.append(point) }
        else { mark.points = [mark.points[0], point] }
        draft = mark
        needsDisplay = true
    }
    override func mouseUp(with event: NSEvent) {
        guard let owner, let mark = draft else { return }
        owner.state.canvases[canvasKey, default: []].append(mark)
        draft = nil
        needsDisplay = true
        owner.record("stroke", detail: "\(mark.tool) \(colorNames[mark.color]) \(mark.width)pt \(canvasKey)")
        owner.save()
        owner.refresh()
    }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { owner?.setDrawing(false) }
        else { super.keyDown(with: event) }
    }
}

final class StageInkDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var state = SavedState()
    var drawing = false
    var overlays: [OverlayWindow] = []
    var canvases: [Canvas] = []
    var palette: NSPanel!
    var statusItem: NSStatusItem!
    var modeButton: NSButton!
    var toolPicker: NSPopUpButton!
    var colorPicker: NSPopUpButton!
    var widthPicker: NSPopUpButton!
    var boardPicker: NSPopUpButton!
    var summary: NSTextField!
    var saveLabel: NSTextField!
    var hotKeys: [EventHotKeyRef] = []
    var timerWindow: NSWindow?
    var timerLabel: NSTextField!
    var timerStatus: NSTextField!
    var durationField: NSTextField!
    var startButton: NSButton!
    var ticker: Timer?
    var deadline: Date?
    var remaining = 60.0
    var timerDuration = 60.0
    var folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("StageInk", isDirectory: true)
    var stateURL: URL { folder.appendingPathComponent("State.json") }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let legacyURL = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("State.json")
        if !FileManager.default.fileExists(atPath: stateURL.path), let legacy = try? Data(contentsOf: legacyURL) {
            try? legacy.write(to: stateURL, options: .atomic)
        }
        if let data = try? Data(contentsOf: stateURL), let saved = try? JSONDecoder().decode(SavedState.self, from: data) { state = saved }
        if !toolNames.contains(state.tool) { state.tool = "Pen" }
        state.color = max(0, min(state.color, inkColors.count-1))
        state.width = max(1, min(state.width, 30))
        if !["Desktop", "Whiteboard", "Blackboard"].contains(state.background) { state.background = "Desktop" }
        makeMenu()
        makeOverlays()
        makePalette()
        registerShortcuts()
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 { self?.setDrawing(false); return nil }
            return event
        }
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        setDrawing(false)
        record("launch", detail: "safe Interact mode; \(overlays.count) displays")
        NSApp.activate(ignoringOtherApps: true)
    }
    func makeMenu() {
        let menu = NSMenu()
        let root = NSMenuItem()
        menu.addItem(root)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Show StageInk", action: #selector(showPalette), keyEquivalent: "")
        appMenu.addItem(withTitle: "Quit StageInk", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        root.submenu = appMenu
        NSApp.mainMenu = menu
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "StageInk"
        let statusMenu = NSMenu()
        statusMenu.addItem(withTitle: "Show Controls", action: #selector(showPalette), keyEquivalent: "")
        statusMenu.addItem(withTitle: "Toggle Draw / Interact", action: #selector(toggleDrawing), keyEquivalent: "")
        statusMenu.addItem(withTitle: "Break Timer", action: #selector(showTimer), keyEquivalent: "")
        statusMenu.addItem(.separator())
        statusMenu.addItem(withTitle: "Quit StageInk", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        statusItem.menu = statusMenu
    }
    func makeOverlays() {
        for screen in NSScreen.screens {
            let panel = OverlayWindow(contentRect: screen.frame, styleMask: isComponentTest ? [.titled, .closable, .resizable] : [.borderless], backing: .buffered, defer: false)
            panel.title = "StageInk Canvas"
            panel.titleVisibility = isComponentTest ? .visible : .hidden
            panel.titlebarAppearsTransparent = true
            panel.isMovable = false
            if !isComponentTest {
                for kind in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] { panel.standardWindowButton(kind)?.isHidden = true }
            }
            panel.level = isComponentTest ? .normal : NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 1)
            panel.backgroundColor = isComponentTest ? .white : .clear
            panel.isOpaque = isComponentTest
            panel.hasShadow = false
            panel.hidesOnDeactivate = false
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.isReleasedWhenClosed = false
            if isComponentTest {
                panel.setFrame(NSRect(x: screen.visibleFrame.minX + 350, y: screen.visibleFrame.minY + 80, width: 950, height: 650), display: true)
                panel.title = "StageInk Drawing Test — same Canvas event handlers"
                panel.setAccessibilitySubrole(.standardWindow)
            }
            let canvas = Canvas(frame: NSRect(origin: .zero, size: panel.contentView!.bounds.size))
            canvas.setAccessibilityElement(true)
            canvas.setAccessibilityRole(.group)
            canvas.setAccessibilityLabel("StageInk drawing canvas")
            canvas.owner = self
            canvas.displayID = String(describing: screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] ?? "main")
            canvas.autoresizingMask = [.width, .height]
            panel.contentView = canvas
            panel.ignoresMouseEvents = true
            panel.orderFrontRegardless()
            overlays.append(panel)
            canvases.append(canvas)
            if isComponentTest { break }
        }
    }
    @objc func screensChanged() {
        for overlay in overlays { overlay.close() }
        overlays = []; canvases = []
        makeOverlays()
        setDrawing(drawing)
    }
    func makePalette() {
        let screen = NSScreen.main!.visibleFrame
        palette = NSPanel(contentRect: NSRect(x: screen.minX + 30, y: screen.maxY - 480, width: 310, height: 420), styleMask: [.titled, .closable, .utilityWindow], backing: .buffered, defer: false)
        palette.title = "StageInk — presentation ink"
        palette.isReleasedWhenClosed = false
        palette.delegate = self
        palette.appearance = NSAppearance(named: .aqua)
        palette.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 2)
        palette.hidesOnDeactivate = false
        palette.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 310, height: 420))
        palette.contentView = view
        modeButton = button("Start drawing  ⌘⌥D", action: #selector(toggleDrawing), frame: NSRect(x: 18, y: 362, width: 274, height: 40), in: view)
        modeButton.setAccessibilityIdentifier("drawingMode")
        label("Tool", x: 20, y: 324, in: view)
        toolPicker = popup(toolNames, action: #selector(toolChanged), frame: NSRect(x: 105, y: 316, width: 184, height: 30), in: view)
        label("Color", x: 20, y: 282, in: view)
        colorPicker = popup(colorNames, action: #selector(colorChanged), frame: NSRect(x: 105, y: 274, width: 184, height: 30), in: view)
        label("Width", x: 20, y: 240, in: view)
        widthPicker = popup(["2 pt", "4 pt", "6 pt", "10 pt", "16 pt"], action: #selector(widthChanged), frame: NSRect(x: 105, y: 232, width: 184, height: 30), in: view)
        label("Surface", x: 20, y: 198, in: view)
        boardPicker = popup(["Desktop", "Whiteboard", "Blackboard"], action: #selector(boardChanged), frame: NSRect(x: 105, y: 190, width: 184, height: 30), in: view)
        let undoButton = button("Undo  ⌘⌥Z", action: #selector(undo), frame: NSRect(x: 18, y: 142, width: 130, height: 32), in: view)
        let clearButton = button("Clear  ⌘⌥X", action: #selector(clear), frame: NSRect(x: 157, y: 142, width: 135, height: 32), in: view)
        let timerButton = button("Break timer", action: #selector(showTimer), frame: NSRect(x: 18, y: 100, width: 130, height: 32), in: view)
        _ = button("Practice surface", action: #selector(showFixture), frame: NSRect(x: 157, y: 100, width: 135, height: 32), in: view)
        toolPicker.isEnabled = featureStage >= 2
        colorPicker.isEnabled = featureStage >= 2
        widthPicker.isEnabled = featureStage >= 2
        undoButton.isEnabled = featureStage >= 2
        clearButton.isEnabled = featureStage >= 2
        boardPicker.isEnabled = featureStage >= 3
        timerButton.isEnabled = featureStage >= 4
        summary = NSTextField(wrappingLabelWithString: "")
        summary.font = .systemFont(ofSize: 12)
        summary.frame = NSRect(x: 20, y: 43, width: 270, height: 45)
        view.addSubview(summary)
        saveLabel = NSTextField(labelWithString: "Settings saved in Application Support")
        saveLabel.font = .systemFont(ofSize: 10)
        saveLabel.textColor = .secondaryLabelColor
        saveLabel.frame = NSRect(x: 20, y: 15, width: 275, height: 20)
        view.addSubview(saveLabel)
        palette.orderFrontRegardless()
    }
    func label(_ text: String, x: CGFloat, y: CGFloat, in view: NSView) {
        let label = NSTextField(labelWithString: text)
        label.frame = NSRect(x: x, y: y, width: 85, height: 20)
        view.addSubview(label)
    }
    @discardableResult func button(_ title: String, action: Selector, frame: NSRect, in view: NSView) -> NSButton {
        let button = NSButton(title: title, target: self, action: action)
        button.bezelStyle = .rounded
        button.frame = frame
        view.addSubview(button)
        return button
    }
    func popup(_ items: [String], action: Selector, frame: NSRect, in view: NSView) -> NSPopUpButton {
        let popup = NSPopUpButton(frame: frame, pullsDown: false)
        popup.addItems(withTitles: items)
        popup.target = self; popup.action = action
        view.addSubview(popup)
        return popup
    }
    @objc func showPalette() { palette.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    @objc func toggleDrawing() { setDrawing(!drawing) }
    func setDrawing(_ value: Bool) {
        drawing = value
        for (index, overlay) in overlays.enumerated() {
            overlay.ignoresMouseEvents = !value
            canvases[index].draft = nil
            canvases[index].needsDisplay = true
            overlay.orderFrontRegardless()
        }
        palette?.orderFrontRegardless()
        record("mode", detail: value ? "Draw" : "Interact")
        refresh()
    }
    @objc func toolChanged() { state.tool = toolPicker.titleOfSelectedItem ?? "Pen"; save(); setDrawing(true) }
    @objc func colorChanged() { state.color = colorPicker.indexOfSelectedItem; save(); refresh() }
    @objc func widthChanged() { state.width = Double(widthPicker.titleOfSelectedItem!.split(separator: " ")[0]) ?? 6; save(); refresh() }
    @objc func boardChanged() { setBoard(boardPicker.titleOfSelectedItem ?? "Desktop") }
    func setBoard(_ background: String) {
        state.background = background
        for canvas in canvases { canvas.draft = nil; canvas.needsDisplay = true }
        save(); refresh(); record("surface", detail: background)
    }
    @objc func undo() {
        for canvas in canvases where !(state.canvases[canvas.canvasKey, default: []].isEmpty) {
            state.canvases[canvas.canvasKey]?.removeLast()
            canvas.needsDisplay = true
        }
        save(); refresh(); record("undo", detail: state.background)
    }
    @objc func clear() {
        for canvas in canvases { state.canvases[canvas.canvasKey] = []; canvas.draft = nil; canvas.needsDisplay = true }
        save(); refresh(); record("clear", detail: state.background)
    }
    func refresh() {
        guard palette != nil else { return }
        modeButton.title = drawing ? "Stop drawing  ⌘⌥D" : "Start drawing  ⌘⌥D"
        modeButton.contentTintColor = drawing ? .systemRed : .systemBlue
        toolPicker.selectItem(withTitle: state.tool)
        colorPicker.selectItem(at: state.color)
        widthPicker.selectItem(withTitle: "\(Int(state.width)) pt")
        boardPicker.selectItem(withTitle: state.background)
        let count = canvases.reduce(0) { $0 + state.canvases[$1.canvasKey, default: []].count }
        summary.stringValue = "\(drawing ? "DRAW • mouse draws" : "INTERACT • mouse passes through")\n\(state.background) • \(count) marks • Escape exits drawing"
        statusItem.button?.title = drawing ? "StageInk ●" : "StageInk"
    }
    func save() {
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); let data = try JSONEncoder().encode(state); try data.write(to: stateURL, options: .atomic); saveLabel?.stringValue = "Saved • Application Support/StageInk" }
        catch { saveLabel?.stringValue = "Save failed • \(error.localizedDescription)"; record("save-error", detail: error.localizedDescription) }
    }
    func record(_ event: String, detail: String) {
        let url = folder.appendingPathComponent("runtime-events.jsonl")
        guard let data = try? JSONSerialization.data(withJSONObject: ["time": Date().ISO8601Format(), "event": event, "detail": detail]) else { return }
        if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
        if let handle = try? FileHandle(forWritingTo: url) { _ = try? handle.seekToEnd(); try? handle.write(contentsOf: data + Data([10])); try? handle.close() }
    }
    @objc func showFixture() {
        setDrawing(false)
        setBoard("Desktop")
        NSWorkspace.shared.openApplication(at: Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/Practice Surface.app"), configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
    }
    func registerShortcuts() {
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, event, userData in
            guard let event, let userData else { return noErr }
            var id = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
            let owner = Unmanaged<StageInkDelegate>.fromOpaque(userData).takeUnretainedValue()
            owner.handleShortcut(Int(id.id))
            return noErr
        }, 1, &spec, Unmanaged.passUnretained(self).toOpaque(), nil)
        let keys = [kVK_ANSI_D, kVK_ANSI_P, kVK_ANSI_L, kVK_ANSI_A, kVK_ANSI_R, kVK_ANSI_E, kVK_ANSI_Z, kVK_ANSI_X, kVK_ANSI_0, kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_T]
        for (index, key) in keys.enumerated() {
            var ref: EventHotKeyRef?
            let result = RegisterEventHotKey(UInt32(key), UInt32(cmdKey | optionKey), EventHotKeyID(signature: 0x53494E4B, id: UInt32(index)), GetApplicationEventTarget(), 0, &ref)
            if let ref { hotKeys.append(ref) }
            record("shortcut-register", detail: "\(index) status \(result)")
        }
    }
    func handleShortcut(_ id: Int) {
        guard id == 0 || (featureStage >= 2 && id <= 7) || (featureStage >= 3 && id <= 10) || featureStage >= 4 else { return }
        record("shortcut", detail: String(id))
        switch id {
        case 0: toggleDrawing()
        case 1...5: state.tool = toolNames[id-1]; save(); setDrawing(true)
        case 6: undo()
        case 7: clear()
        case 8: setBoard("Desktop")
        case 9: setBoard("Whiteboard")
        case 10: setBoard("Blackboard")
        case 11: showTimer()
        default: break
        }
    }
    @objc func showTimer() {
        guard featureStage >= 4 else { return }
        if let timerWindow { timerWindow.makeKeyAndOrderFront(nil); return }
        let window = NSWindow(contentRect: NSRect(x: 450, y: 350, width: 440, height: 300), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "StageInk — break timer"
        window.appearance = NSAppearance(named: .aqua)
        window.level = NSWindow.Level(rawValue: NSWindow.Level.floating.rawValue + 3)
        window.isReleasedWhenClosed = false
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 300))
        window.contentView = view
        timerStatus = NSTextField(labelWithString: "Ready for a break")
        timerStatus.alignment = .center
        timerStatus.frame = NSRect(x: 20, y: 254, width: 400, height: 26)
        view.addSubview(timerStatus)
        timerLabel = NSTextField(labelWithString: "01:00")
        timerLabel.font = .monospacedDigitSystemFont(ofSize: 76, weight: .medium)
        timerLabel.alignment = .center
        timerLabel.frame = NSRect(x: 20, y: 148, width: 400, height: 96)
        view.addSubview(timerLabel)
        label("Seconds", x: 80, y: 111, in: view)
        durationField = NSTextField(string: "60")
        durationField.frame = NSRect(x: 165, y: 105, width: 110, height: 28)
        durationField.setAccessibilityIdentifier("timerSeconds")
        view.addSubview(durationField)
        _ = button("Set", action: #selector(setDuration), frame: NSRect(x: 290, y: 101, width: 70, height: 34), in: view)
        startButton = button("Start", action: #selector(toggleTimer), frame: NSRect(x: 90, y: 45, width: 120, height: 38), in: view)
        _ = button("Reset", action: #selector(resetTimer), frame: NSRect(x: 230, y: 45, width: 120, height: 38), in: view)
        timerWindow = window
        window.makeKeyAndOrderFront(nil)
        record("timer-show", detail: "60 seconds initial")
    }
    @objc func setDuration() {
        guard let seconds = Double(durationField.stringValue), seconds.isFinite, seconds >= 1, seconds <= 86400 else {
            timerStatus.stringValue = "Enter 1–86400 seconds"
            return
        }
        timerDuration = seconds.rounded()
        resetTimer()
        record("timer-set", detail: String(timerDuration))
    }
    @objc func toggleTimer() {
        if let deadline {
            remaining = max(0, deadline.timeIntervalSinceNow)
            self.deadline = nil
            ticker?.invalidate(); ticker = nil
            timerStatus.stringValue = "Paused"
            startButton.title = "Resume"
            record("timer-pause", detail: String(remaining))
        } else {
            if remaining <= 0 { remaining = timerDuration }
            deadline = Date().addingTimeInterval(remaining)
            ticker = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in self?.tick() }
            startButton.title = "Pause"
            timerStatus.stringValue = "Break in progress"
            record("timer-start", detail: String(remaining))
        }
    }
    func tick() {
        guard let deadline else { return }
        remaining = max(0, deadline.timeIntervalSinceNow)
        updateTimerLabel()
        if remaining <= 0 {
            ticker?.invalidate(); ticker = nil; self.deadline = nil
            timerStatus.stringValue = "Break complete"
            startButton.title = "Start"
            record("timer-complete", detail: "0 seconds")
        }
    }
    func updateTimerLabel() {
        let seconds = Int(ceil(remaining))
        timerLabel.stringValue = String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
    @objc func resetTimer() {
        ticker?.invalidate(); ticker = nil; deadline = nil
        remaining = timerDuration
        updateTimerLabel()
        timerStatus.stringValue = "Ready for a break"
        startButton.title = "Start"
        record("timer-reset", detail: String(remaining))
    }
    func windowWillClose(_ notification: Notification) {
        if notification.object as? NSWindow === palette, drawing {
            overlays.first?.makeKeyAndOrderFront(nil)
        }
    }
    func applicationWillTerminate(_ notification: Notification) {
        save()
        for hotKey in hotKeys { UnregisterEventHotKey(hotKey) }
        ticker?.invalidate()
        record("quit", detail: "saved")
    }
}
let delegate = StageInkDelegate()
NSApplication.shared.delegate = delegate
NSApplication.shared.run()

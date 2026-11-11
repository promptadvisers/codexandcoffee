// Concatenated with the production source, minus its three-line application entry point.
// Direct handler calls in a hidden NSWindow. These are component checks, not desktop input tests.
let testApp = NSApplication.shared
let checker = StageInkDelegate()
checker.folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: checker.folder, withIntermediateDirectories: true)
let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 560), styleMask: [.titled], backing: .buffered, defer: false)
let canvas = Canvas(frame: NSRect(x: 0, y: 0, width: 900, height: 560))
canvas.owner = checker
canvas.displayID = "component-test"
window.contentView = canvas
checker.canvases = [canvas]
checker.drawing = true
checker.state.background = "Whiteboard"
var results: [[String: Any]] = []
func check(_ name: String, _ condition: @autoclosure () -> Bool) {
    let passed = condition()
    results.append(["check": name, "passed": passed, "method": "in-process production component"])
    print("\(passed ? "PASS" : "FAIL") \(name)")
}
func event(_ type: NSEvent.EventType, _ point: NSPoint) -> NSEvent {
    NSEvent.mouseEvent(with: type, location: point, modifierFlags: [], timestamp: 1, windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)!
}
func stroke(_ tool: String, _ points: [NSPoint], color: Int, width: Double) {
    checker.state.tool = tool; checker.state.color = color; checker.state.width = width
    canvas.mouseDown(with: event(.leftMouseDown, points[0]))
    for point in points.dropFirst() { canvas.mouseDragged(with: event(.leftMouseDragged, point)) }
    canvas.mouseUp(with: event(.leftMouseUp, points.last!))
}
stroke("Pen", [NSPoint(x: 50,y: 400), NSPoint(x: 100,y: 440), NSPoint(x: 150,y: 390), NSPoint(x: 200,y: 430)], color: 0, width: 6)
stroke("Line", [NSPoint(x: 260,y: 400), NSPoint(x: 410,y: 460)], color: 1, width: 4)
stroke("Arrow", [NSPoint(x: 470,y: 410), NSPoint(x: 670,y: 450)], color: 2, width: 10)
stroke("Rectangle", [NSPoint(x: 270,y: 300), NSPoint(x: 60,y: 180)], color: 3, width: 6)
stroke("Ellipse", [NSPoint(x: 640,y: 300), NSPoint(x: 380,y: 170)], color: 1, width: 10)
let marks = checker.state.canvases[canvas.canvasKey]!
check("five production mouse-handler strokes committed", marks.count == 5)
check("pen retains intermediate drag samples", marks[0].points.count == 4)
check("shapes retain exactly two endpoints", marks.dropFirst().allSatisfy { $0.points.count == 2 })
check("reverse rectangle endpoints preserved", marks[3].points[0].x > marks[3].points[1].x)
check("reverse ellipse endpoints preserved", marks[4].points[0].y < marks[4].points[1].y)
check("stroke color and width captured at creation", marks[2].color == 2 && marks[2].width == 10)
if let rep = canvas.bitmapImageRepForCachingDisplay(in: canvas.bounds) {
    canvas.cacheDisplay(in: canvas.bounds, to: rep)
    try rep.representation(using: .png, properties: [:])!.write(to: checker.folder.appendingPathComponent("production-canvas-component-render.png"))
    var colored = 0
    for y in stride(from: 0, to: rep.pixelsHigh, by: 3) {
        for x in stride(from: 0, to: rep.pixelsWide, by: 3) {
            if let c = rep.colorAt(x: x,y: y)?.usingColorSpace(.deviceRGB), max(c.redComponent,c.greenComponent,c.blueComponent)-min(c.redComponent,c.greenComponent,c.blueComponent) > 0.15 { colored += 1 }
        }
    }
    check("production paint renders colored pixels", colored > 100)
}
checker.undo()
check("undo removes newest mark", checker.state.canvases[canvas.canvasKey]!.count == 4)
checker.state.background = "Blackboard"
check("new board begins separately", checker.state.canvases[canvas.canvasKey, default: []].isEmpty)
stroke("Pen", [NSPoint(x:20,y:20)], color: 4,width:2)
check("single click creates a mark", checker.state.canvases[canvas.canvasKey]!.count == 1)
checker.clear()
check("clear empties only selected board", checker.state.canvases[canvas.canvasKey]!.isEmpty && checker.state.canvases["component-test/Whiteboard"]!.count == 4)
checker.undo(); checker.clear()
check("empty undo and clear are safe", checker.state.canvases[canvas.canvasKey]!.isEmpty)
checker.state.background = "Whiteboard"
checker.save()
let restored = try JSONDecoder().decode(SavedState.self, from: Data(contentsOf: checker.stateURL))
check("settings and canvas JSON round trip", restored.canvases[canvas.canvasKey]!.count == 4 && restored.width == 2)
checker.drawing = false
stroke("Line",[NSPoint(x:1,y:1), NSPoint(x:8,y:8)],color:0,width:6)
check("inactive handler rejects new stroke", checker.state.canvases[canvas.canvasKey]!.count == 4)
checker.drawing = true
checker.state.tool = "Line"
canvas.mouseDown(with: event(.leftMouseDown, NSPoint(x: 10, y: 10)))
canvas.mouseDragged(with: event(.leftMouseDragged, NSPoint(x: 20, y: 20)))
canvas.mouseUp(with: event(.leftMouseUp, NSPoint(x: 70, y: 70)))
check("release point is retained after the last drag event", checker.state.canvases[canvas.canvasKey]!.last!.points.last!.x == 70)
let originalFolder = checker.folder
checker.folder = originalFolder.appendingPathComponent("fresh-settings/subfolder", isDirectory: true)
checker.save()
check("save creates a writable settings directory", FileManager.default.fileExists(atPath: checker.stateURL.path))
checker.folder = originalFolder
checker.timerLabel = NSTextField(labelWithString: "")
checker.timerStatus = NSTextField(labelWithString: "")
checker.startButton = NSButton()
checker.durationField = NSTextField(string: "3")
checker.setDuration()
check("timer accepts three seconds", checker.remaining == 3 && checker.timerLabel.stringValue == "00:03")
checker.durationField.stringValue = "-1"; checker.setDuration()
check("timer rejects invalid duration", checker.timerDuration == 3 && checker.timerStatus.stringValue.contains("Enter"))
checker.toggleTimer()
check("timer starts with deadline", checker.deadline != nil && checker.startButton.title == "Pause")
checker.toggleTimer()
check("timer pauses and exposes resume", checker.deadline == nil && checker.startButton.title == "Resume")
checker.deadline = Date().addingTimeInterval(-1)
checker.tick()
check("timer completion clamps at zero", checker.remaining == 0 && checker.timerStatus.stringValue == "Break complete")
checker.resetTimer()
check("timer reset restores chosen duration", checker.remaining == 3 && checker.startButton.title == "Start")
let data = try JSONSerialization.data(withJSONObject: results, options: [.prettyPrinted,.sortedKeys])
try data.write(to: checker.folder.appendingPathComponent("results.json"))
exit(results.allSatisfy { $0["passed"] as? Bool == true } ? 0 : 1)

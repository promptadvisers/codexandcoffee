import Foundation

// Pure transition rules. Permission callbacks carry generation tokens, never arm a new hold.
struct HoldState {
    enum Phase: String { case idle, permission, recording, transcribing, asking, status, inserting, verifying }
    enum Release { case ignored, abandonPermission, discard, transcribe }
    private(set) var phase: Phase = .idle
    private(set) var held = false
    private(set) var generation = 0
    private(set) var started: TimeInterval = 0
    mutating func press() -> Int? {
        guard !held else { return nil }
        held = true
        guard phase == .idle else { return nil }
        generation += 1; phase = .permission
        return generation
    }
    mutating func permission(_ token: Int, granted: Bool, now: TimeInterval) -> Bool {
        guard token == generation, held, phase == .permission else { return false }
        guard granted else { phase = .idle; return false }
        phase = .recording; started = now; return true
    }
    mutating func release(now: TimeInterval) -> Release {
        held = false
        switch phase {
        case .permission: generation += 1; phase = .idle; return .abandonPermission
        case .recording:
            if now - started < 0.25 { generation += 1; phase = .idle; return .discard }
            phase = .transcribing; return .transcribe
        default: return .ignored
        }
    }
    mutating func begin(_ next: Phase) -> Int? {
        guard phase == .idle else { return nil }
        generation += 1; phase = next; return generation
    }
    mutating func transition(_ next: Phase) { phase = next }
    mutating func finish() { phase = .idle }
    mutating func cancel() { generation += 1; phase = .idle } // held remains latched until physical release
    func accepts(_ token: Int) -> Bool { token == generation && phase != .idle }
}

// AXSubrole is optional for ordinary text controls. Known secure/protected controls fail closed.
enum HelperTargetPolicy {
    static func eligible(role: String?, subrole: String?, protected: Bool, enabled: Bool) -> Bool {
        guard let role = role, enabled, !protected else { return false }
        return ["AXTextField", "AXTextArea", "AXComboBox"].contains(role) && subrole != "AXSecureTextField"
    }
    static func canInsert(eligible: Bool, focusLost: Bool, sameField: Bool) -> Bool {
        eligible && !focusLost && sameField
    }
}


// AX ranges are UTF-16 offsets, not Swift Character counts. Never replace a whole field
// without a valid selected range; never split a surrogate pair or overflow range arithmetic.
enum HelperTextEdit {
    static func replacing(value: String, location: Int, length: Int, text: String) -> (value: String, caret: Int)? {
        let count = value.utf16.count
        guard location >= 0, length >= 0, location <= count, length <= count - location,
              Range(NSRange(location: location, length: length), in: value) != nil else { return nil }
        let ns = value as NSString
        for offset in [location, location + length] where offset > 0 && offset < count {
            if (0xD800...0xDBFF).contains(ns.character(at: offset - 1)) && (0xDC00...0xDFFF).contains(ns.character(at: offset)) { return nil }
        }
        return ((value as NSString).replacingCharacters(in: NSRange(location: location, length: length), with: text), location + text.utf16.count)
    }
}

// Option alone is a modifier, not a Carbon key chord. Debounce brief taps and
// latch a conflicting chord until all Option keys are released.
struct OptionHoldTrigger {
    enum Action { case none, press, release, cancel }
    private var down = false, blocked = false, started = false
    private var began: TimeInterval = 0
    init(initiallyDown: Bool = false) { down = initiallyDown; blocked = initiallyDown }
    mutating func update(optionDown: Bool, otherKeyDown: Bool, now: TimeInterval) -> Action {
        if !optionDown {
            let release = started
            down = false; blocked = false; started = false
            return release ? .release : .none
        }
        if !down { down = true; began = now }
        if otherKeyDown {
            let cancel = started && !blocked
            blocked = true
            return cancel ? .cancel : .none
        }
        guard !blocked, !started, now - began >= 0.10 else { return .none }
        started = true
        return .press
    }
}

// A successful OS call is not proof that a rich editor accepted the text.
enum HelperPasteVerification {
    static func outcome(before: String?, expected: String?, after: String?, sameField: Bool) -> String {
        guard sameField, let before = before, let expected = expected, let after = after,
              expected != before, after == expected else { return "paste_unverified" }
        return "inserted_verified"
    }
    static func restoreClipboard(written: Int, current: Int) -> Bool { written == current }
    static func canCancel(pasteCommitted: Bool) -> Bool { !pasteCommitted }
}

// Failed AX reads are uncertainty, not proof that the user changed fields.
enum HelperFocusObservation { case same, moved, unavailable }
struct HelperFocusTracker {
    private(set) var lost = false
    mutating func observe(_ observation: HelperFocusObservation) {
        if observation == .moved { lost = true }
    }
}

enum PasteCheck: Equatable { case wait, verified, unverified(String) }
struct HelperPasteMonitor {
    let before: String?, expected: String?, deadline: TimeInterval
    private var matches = 0
    private var reason = "unchanged"
    init(before: String?, expected: String?, deadline: TimeInterval) {
        self.before = before; self.expected = expected; self.deadline = deadline
    }
    mutating func observe(after: String?, focus: HelperFocusObservation, now: TimeInterval) -> PasteCheck {
        if focus == .moved { return .unverified("focus_lost_after_paste") }
        if focus == .unavailable { matches = 0; reason = "focus_unavailable" }
        else if before == nil || after == nil { matches = 0; reason = "value_unreadable" }
        else if expected == nil { matches = 0; reason = "range_unreadable" }
        else {
            // Only normalize equivalent line endings. Do not collapse whitespace or
            // accept a substring that may already have existed before the paste.
            let normalize: (String) -> String = { $0.replacingOccurrences(of: "\r\n", with: "\n") }
            if after != before && normalize(after!) == normalize(expected!) && normalize(expected!) != normalize(before!) {
                matches += 1
                if matches >= 2 { return .verified }
            } else { matches = 0; reason = after == before ? "unchanged" : "mismatch" }
        }
        return now >= deadline ? .unverified(reason) : .wait
    }
}

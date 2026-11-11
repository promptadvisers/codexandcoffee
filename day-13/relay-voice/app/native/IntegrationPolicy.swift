import Foundation

// Shared pure decisions used by the native app and its executable checks.
enum IntegrationPolicy {
    static func insertionAllowed(secure: Bool, sameField: Bool, activeTarget: Bool) -> Bool {
        !secure && sameField && activeTarget
    }
    static func acceptsResult(request: Int, current: Int) -> Bool { request == current }
    static func restoreClipboard(originalWrite: Int, current: Int) -> Bool { originalWrite == current }
    static func meterHeight(decibels: Float) -> Double {
        max(3, min(26, Double(pow(10, decibels / 40)) * 26))
    }
}

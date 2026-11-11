import Foundation

@main struct NativeChecks {
    static func main() {
        precondition(IntegrationPolicy.insertionAllowed(secure: false, sameField: true, activeTarget: true))
        precondition(!IntegrationPolicy.insertionAllowed(secure: true, sameField: true, activeTarget: true))
        precondition(!IntegrationPolicy.insertionAllowed(secure: false, sameField: false, activeTarget: true))
        precondition(!IntegrationPolicy.insertionAllowed(secure: false, sameField: true, activeTarget: false))
        precondition(!IntegrationPolicy.acceptsResult(request: 1, current: 2))
        precondition(IntegrationPolicy.acceptsResult(request: 2, current: 2))
        precondition(!IntegrationPolicy.restoreClipboard(originalWrite: 2, current: 3))
        precondition(IntegrationPolicy.restoreClipboard(originalWrite: 2, current: 2))
        precondition(IntegrationPolicy.meterHeight(decibels: -80) == 3)
        precondition(IntegrationPolicy.meterHeight(decibels: 0) == 26)
        precondition(IntegrationPolicy.meterHeight(decibels: -20) > IntegrationPolicy.meterHeight(decibels: -40))
        print("Native policy checks passed: secure/focus guards, stale request, clipboard ownership, actual meter mapping.")
    }
}

import Foundation

enum VoiceIntent {
    static func command(from text: String) -> String? {
        let pattern = #"(?i)^\s*(?:hey\s+)?relay\b[\s,:.!-]*"#
        guard let range = text.range(of: pattern, options: .regularExpression) else { return nil }
        let remainder = String(text[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return remainder.isEmpty ? nil : remainder
    }
}

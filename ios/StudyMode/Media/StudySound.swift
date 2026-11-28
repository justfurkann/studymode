import AudioToolbox
import UIKit

@MainActor
enum StudySound: String {
    case paperBasket = "PaperBasket"
    case reviewComplete = "ReviewComplete"
    case answerCorrect = "AnswerCorrect"
    case answerIncorrect = "AnswerIncorrect"

    static let preferenceKey = "studymode.soundEffects"
    static let enabledByDefault = true

    private static var soundIDs: [StudySound: SystemSoundID] = [:]

    static func playAnswer(isCorrect: Bool) {
        (isCorrect ? Self.answerCorrect : Self.answerIncorrect).play()
    }

    func play() {
        let enabled = UserDefaults.standard.object(forKey: Self.preferenceKey) as? Bool
            ?? Self.enabledByDefault
        guard enabled, UIApplication.shared.applicationState == .active else { return }

        if let id = Self.soundIDs[self] {
            AudioServicesPlaySystemSoundWithCompletion(id, nil)
            return
        }

        guard let url = Bundle.main.url(forResource: rawValue, withExtension: "wav") else { return }
        var id: SystemSoundID = 0
        guard AudioServicesCreateSystemSoundID(url as CFURL, &id) == kAudioServicesNoError else { return }

        Self.soundIDs[self] = id
        AudioServicesPlaySystemSoundWithCompletion(id, nil)
    }
}

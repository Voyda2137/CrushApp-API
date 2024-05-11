export interface ICognitoChallengeLoginResponse {
    challengeName: string,
    challengeParameters: Record<string, string>,
    session: string
}
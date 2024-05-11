export interface ILoginResponse {
    sub: string,
    id_token: string,
    access_token: string
    newPasswordRequired?: boolean
}
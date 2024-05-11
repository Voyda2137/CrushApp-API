export const noAccessTokenMock = {
    AuthenticationResult: {}
}
export const noSubMock = {
    AuthenticationResult: {
        AccessToken: 'accessToken',
        IdToken: 'idToken'
    }
}
export const successAuthResultMock = {
    AuthenticationResult: {
        AccessToken: 'accessToken',
        IdToken: 'idToken'
    }
}
export const successReturnMock = {
    sub: 'mockSub',
    access_token: 'accessToken',
    id_token: 'idToken'
}
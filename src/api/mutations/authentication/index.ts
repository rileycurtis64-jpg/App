import { JellyfinCredentials } from '../../types/jellyfin-credentials'
import { AuthenticationResult } from '@jellyfin/sdk/lib/generated-client'
import { useMutation } from '@tanstack/react-query'
import { JellifyUser } from '../../../types/JellifyUser'
import { useApi, useJellifyUser } from '../../../stores/auth'
import authenticateUserByName from './utils'
import { captureError, LoggingContext } from '../../../utils/logging'
import { exchangeJellyfinTokenForJellyMusic } from '../../../services/jelly-music/client'
import { Alert } from 'react-native'

interface AuthenticateUserByNameMutation {
	onSuccess?: () => void
	onError?: (error: Error) => void
}

const useAuthenticateUserByName = ({ onSuccess, onError }: AuthenticateUserByNameMutation) => {
	const api = useApi()
	const [, setUser] = useJellifyUser()

	return useMutation({
		mutationFn: (credentials: JellyfinCredentials) => {
			return authenticateUserByName(api, credentials.username, credentials.password)
		},
		onSuccess: async (authResult: AuthenticationResult) => {
			const user: JellifyUser = {
				id: authResult.User!.Id!,
				name: authResult.User!.Name!,
				accessToken: authResult.AccessToken as string,
			}

			setUser(user)

			try {
				const jellyMusicUser = await exchangeJellyfinTokenForJellyMusic(user.accessToken)
				console.log('[Jelly Music] SSO SUCCESS', jellyMusicUser.username)
				Alert.alert(
					'Jelly Music SSO SUCCESS',
					`Linked as ${jellyMusicUser.username}`,
				)
			} catch (error: any) {
				const details = {
					message: error?.message ?? null,
					code: error?.code ?? null,
					status: error?.response?.status ?? null,
					data: error?.response?.data ?? null,
				}
				console.error('[Jelly Music] SSO FAILED', details)
				Alert.alert(
					'Jelly Music SSO FAILED',
					JSON.stringify(details, null, 2),
				)
			}

			if (onSuccess) onSuccess()
		},
		onError: (error: Error) => {
			captureError(
				error,
				LoggingContext.Authentication,
				'An error occurred connecting to the Jellyfin instance',
			)

			if (onError) onError(error)
		},
		retry: 0,
		gcTime: 0,
	})
}

export default useAuthenticateUserByName

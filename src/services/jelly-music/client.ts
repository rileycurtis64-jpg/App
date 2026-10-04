import Config from 'react-native-superconfig'
import AXIOS_INSTANCE from '../../configs/networking/axios.config'
import {
	clearJellyMusicSession,
	getJellyMusicSessionToken,
	setJellyMusicSession,
} from './auth'

export type JellyMusicUser = {
	id: string
	username: string
	displayName: string
	isAdmin: boolean
	createdAt?: string
}

type JellyMusicAuthResponse = {
	ok: boolean
	authenticated: boolean
	action?: string
	user: JellyMusicUser
	sessionToken?: string
	sessionExpiresAt?: string
	error?: string
}

type JellyMusicTokenExchangeResponse = {
	ok: boolean
	authenticated: boolean
	action: 'jellyfin-token'
	user: JellyMusicUser
	sessionToken?: string
	sessionExpiresAt?: string
	error?: string
}

export type JellyMusicHistoryEvent = {
	action: 'start' | 'progress' | 'stop' | 'skip'
	song: {
		id: string
		title?: string
		albumArtist?: string
		artists?: string[]
		album?: string
		track?: number
		year?: number
		durationSeconds?: number
	}
	playSessionId: string
	positionSeconds?: number
	secondsListened?: number
	endReason?: string
	playbackContext?: string
}

function configuredBaseUrl(): string | undefined {
	const config = Config as unknown as Record<string, string | undefined>
	const value = config.JELLY_MUSIC_URL?.trim()

	if (!value) return undefined

	return value.replace(/\/+$/, '')
}

export function isJellyMusicConfigured(): boolean {
	return Boolean(configuredBaseUrl())
}

function requireJellyMusicBaseUrl(): string {
	const baseUrl = configuredBaseUrl()

	if (!baseUrl) {
		throw new Error('Jelly Music is not configured.')
	}

	return baseUrl
}

export async function loginToJellyMusic(
	username: string,
	password: string,
): Promise<JellyMusicUser> {
	const baseUrl = requireJellyMusicBaseUrl()

	const response = await AXIOS_INSTANCE.post<JellyMusicAuthResponse>(
		`${baseUrl}/api/account`,
		{
			action: 'login',
			username,
			password,
		},
		{
			headers: {
				'X-Jelly-Music-Client': 'native',
			},
		},
	)

	const { sessionToken, sessionExpiresAt, user } = response.data

	if (!sessionToken) {
		throw new Error('Jelly Music login did not return a session token.')
	}

	setJellyMusicSession(sessionToken, sessionExpiresAt)

	return user
}

export async function exchangeJellyfinTokenForJellyMusic(
	jellyfinAccessToken: string,
): Promise<JellyMusicUser> {
	const baseUrl = requireJellyMusicBaseUrl()

	const response = await AXIOS_INSTANCE.post<JellyMusicTokenExchangeResponse>(
		`${baseUrl}/api/account/jellyfin-token`,
		{
			jellyfinAccessToken,
		},
	)

	const { sessionToken, sessionExpiresAt, user } = response.data

	if (!sessionToken) {
		throw new Error('Jelly Music token exchange did not return a session token.')
	}

	setJellyMusicSession(sessionToken, sessionExpiresAt)

	return user
}

export async function reportJellyMusicHistory(
	event: JellyMusicHistoryEvent,
): Promise<void> {
	const baseUrl = requireJellyMusicBaseUrl()
	const token = getJellyMusicSessionToken()

	if (!token) {
		throw new Error('Jelly Music is not authenticated.')
	}

	try {
		await AXIOS_INSTANCE.post(`${baseUrl}/api/history`, event, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
	} catch (error: any) {
		if (error?.response?.status === 401) {
			clearJellyMusicSession()
		}

		throw error
	}
}

export type JellyMusicLyricsRequest = {
	jellyfinItemId: string
	title: string
	artist?: string
	album?: string
	durationSeconds?: number
}

export type JellyMusicLyricsResponse = {
	ok: boolean
	source?: 'cache' | 'lrclib'
	cached?: boolean
	found?: boolean
	preferredType?: 'synced' | 'plain'
	lyrics?: {
		provider?: string
		provider_id?: string | null
		synced_lyrics?: string | null
		plain_lyrics?: string | null
		instrumental?: number
	} | null
	error?: string
}

export async function fetchJellyMusicLyrics(
	params: JellyMusicLyricsRequest,
	signal?: AbortSignal,
): Promise<JellyMusicLyricsResponse> {
	const baseUrl = requireJellyMusicBaseUrl()
	const token = getJellyMusicSessionToken()

	if (!token) {
		throw new Error('Jelly Music is not authenticated.')
	}

	try {
		const response = await AXIOS_INSTANCE.get<JellyMusicLyricsResponse>(
			`${baseUrl}/api/lyrics`,
			{
				params,
				headers: {
					Authorization: `Bearer ${token}`,
				},
				signal,
			},
		)

		return response.data
	} catch (error: any) {
		if (error?.response?.status === 401) {
			clearJellyMusicSession()
		}

		throw error
	}
}

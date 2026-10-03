import { storage } from '../../constants/storage'
import { MMKVStorageKeys } from '../../enums/mmkv-storage-keys'

export function getJellyMusicSessionToken(): string | undefined {
	return storage.getString(MMKVStorageKeys.JellyMusicSessionToken)
}

export function getJellyMusicSessionExpiresAt(): string | undefined {
	return storage.getString(MMKVStorageKeys.JellyMusicSessionExpiresAt)
}

export function setJellyMusicSession(token: string, expiresAt?: string): void {
	storage.set(MMKVStorageKeys.JellyMusicSessionToken, token)

	if (expiresAt) {
		storage.set(MMKVStorageKeys.JellyMusicSessionExpiresAt, expiresAt)
	} else {
		storage.remove(MMKVStorageKeys.JellyMusicSessionExpiresAt)
	}
}

export function clearJellyMusicSession(): void {
	storage.remove(MMKVStorageKeys.JellyMusicSessionToken)
	storage.remove(MMKVStorageKeys.JellyMusicSessionExpiresAt)
}

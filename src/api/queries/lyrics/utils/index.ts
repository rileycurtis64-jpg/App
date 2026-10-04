import { Api } from '@jellyfin/sdk/lib/api'
import { isEmpty, isUndefined } from 'lodash'
import { getLyricsApi } from '@jellyfin/sdk/lib/utils/api'
import { LyricsApi } from '@jellyfin/sdk/lib/generated-client/api/lyrics-api'
import { LyricDto } from '@jellyfin/sdk/lib/generated-client/models'
import { TrackItem } from 'react-native-nitro-player'

import getTrackDto from '../../../../utils/mapping/track-extra-payload'
import {
	fetchJellyMusicLyrics,
	isJellyMusicConfigured,
} from '../../../../services/jelly-music/client'
import { getJellyMusicSessionToken } from '../../../../services/jelly-music/auth'

export interface ParsedLyricLine {
	time: number
	text: string
}

type JellyfinLyricLine = {
	Text: string
	Start: number
}

function parseSyncedLrc(lrc: string): JellyfinLyricLine[] {
	const lines: JellyfinLyricLine[] = []

	for (const rawLine of lrc.split(/\r?\n/)) {
		const matches = [...rawLine.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]

		if (matches.length === 0) continue

		const text = rawLine
			.replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, '')
			.trim()

		if (!text) continue

		for (const match of matches) {
			const minutes = Number(match[1]) || 0
			const seconds = Number(match[2]) || 0
			const totalSeconds = minutes * 60 + seconds

			lines.push({
				Text: text,
				Start: Math.round(totalSeconds * 10_000_000),
			})
		}
	}

	return lines.sort((a, b) => a.Start - b.Start)
}

/**
 * Priority:
 * 1. Jellyfin native Lyrics API
 * 2. Jelly Music cached/LRCLIB synced lyrics
 */
export async function fetchRawLyrics(
	api: Api | undefined,
	track: TrackItem,
	signal?: AbortSignal,
): Promise<LyricDto['Lyrics'] | undefined> {
	if (isUndefined(api)) throw new Error('Client not initialized')
	if (!track || isEmpty(String(track.id))) throw new Error('No track provided')

	const dto = getTrackDto(track)
	const jellyfinItemId = dto?.Id ?? String(track.id)

	try {
		const lyricsApi: LyricsApi = getLyricsApi(api)
		const { data } = await lyricsApi.getLyrics(
			{ itemId: jellyfinItemId },
			{ signal },
		)

		if (data?.Lyrics && !isEmpty(data.Lyrics)) {
			return data.Lyrics
		}
	} catch (error) {
		console.debug(
			'[Lyrics] Jellyfin lyrics unavailable; trying Jelly Music.',
			error,
		)
	}

	if (!isJellyMusicConfigured() || !getJellyMusicSessionToken()) {
		return undefined
	}

	try {
		const durationSeconds = dto?.RunTimeTicks
			? Number(dto.RunTimeTicks) / 10_000_000
			: Number(track.duration) || undefined

		const artist =
			dto?.AlbumArtist ??
			dto?.Artists?.[0] ??
			track.artist ??
			undefined

		const result = await fetchJellyMusicLyrics(
			{
				jellyfinItemId,
				title: dto?.Name ?? track.title ?? '',
				artist: artist ? String(artist) : undefined,
				album: dto?.Album ?? undefined,
				durationSeconds,
			},
			signal,
		)

		const synced = result?.lyrics?.synced_lyrics

		if (!synced) return undefined

		const parsed = parseSyncedLrc(synced)

		if (parsed.length === 0) return undefined

		console.debug(
			`[Lyrics] Jelly Music supplied ${parsed.length} synced lines.`,
		)

		return parsed as LyricDto['Lyrics']
	} catch (error) {
		console.warn('[Lyrics] Jelly Music fallback failed', error)
		return undefined
	}
}

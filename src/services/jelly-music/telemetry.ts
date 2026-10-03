import uuid from 'react-native-uuid'
import { TrackItem } from 'react-native-nitro-player'
import getTrackDto from '../../utils/mapping/track-extra-payload'
import {
	isJellyMusicConfigured,
	reportJellyMusicHistory,
} from './client'
import { getJellyMusicSessionToken } from './auth'

type ActiveTelemetrySession = {
	trackId: string
	playSessionId: string
	secondsListened: number
	lastPosition: number
	lastReportedAt: number
	paused: boolean
}

let activeSession: ActiveTelemetrySession | null = null
let reportChain: Promise<void> = Promise.resolve()

function canReport(): boolean {
	return isJellyMusicConfigured() && Boolean(getJellyMusicSessionToken())
}

function safeReport(
	event: Parameters<typeof reportJellyMusicHistory>[0],
): void {
	if (!canReport()) return

	reportChain = reportChain
		.catch(() => undefined)
		.then(() => reportJellyMusicHistory(event))
		.catch((error) => {
			console.debug('[Jelly Music] telemetry report failed', error)
		})
}

function mapTrack(track: TrackItem) {
	const dto = getTrackDto(track)

	const durationSeconds = dto?.RunTimeTicks
		? Number(dto.RunTimeTicks) / 10_000_000
		: track.duration

	return {
		id: dto?.Id ?? String(track.id),
		title: dto?.Name ?? track.title,
		albumArtist: dto?.AlbumArtist ?? undefined,
		artists: dto?.Artists ?? undefined,
		album: dto?.Album ?? undefined,
		track: dto?.IndexNumber ?? undefined,
		year: dto?.ProductionYear ?? undefined,
		durationSeconds: durationSeconds || undefined,
	}
}

export function startJellyMusicTelemetry(
	track: TrackItem,
): void {
	if (!canReport()) {
		activeSession = null
		return
	}

	const song = mapTrack(track)

	activeSession = {
		trackId: String(track.id),
		playSessionId: String(uuid.v4()),
		secondsListened: 0,
		lastPosition: 0,
		lastReportedAt: 0,
		paused: false,
	}

	safeReport({
		action: 'start',
		song,
		playSessionId: activeSession.playSessionId,
		positionSeconds: 0,
		secondsListened: 0,
		playbackContext: 'jellify',
	})
}

export function progressJellyMusicTelemetry(
	track: TrackItem,
	position: number,
): void {
	if (!activeSession || activeSession.trackId !== String(track.id)) {
		return
	}

	const normalizedPosition = Math.max(0, Number(position) || 0)

	const delta = normalizedPosition - activeSession.lastPosition

	if (!activeSession.paused && delta > 0 && delta <= 15) {
		activeSession.secondsListened += delta
	}

	activeSession.lastPosition = normalizedPosition

	if (normalizedPosition - activeSession.lastReportedAt < 10) {
		return
	}

	activeSession.lastReportedAt = normalizedPosition

	safeReport({
		action: 'progress',
		song: mapTrack(track),
		playSessionId: activeSession.playSessionId,
		positionSeconds: normalizedPosition,
		secondsListened: activeSession.secondsListened,
		playbackContext: 'jellify',
	})
}

export function setJellyMusicPaused(
	paused: boolean,
): void {
	if (!activeSession) return

	activeSession.paused = paused
}

export function seekJellyMusicTelemetry(
	position: number,
): void {
	if (!activeSession) return

	const normalizedPosition = Math.max(0, Number(position) || 0)

	activeSession.lastPosition = normalizedPosition
	activeSession.lastReportedAt = normalizedPosition
}

export function finishJellyMusicTelemetry(
	track: TrackItem,
	reason?: string,
): void {
	if (!activeSession || activeSession.trackId !== String(track.id)) {
		return
	}

	const action = reason === 'skip' ? 'skip' : 'stop'

	safeReport({
		action,
		song: mapTrack(track),
		playSessionId: activeSession.playSessionId,
		positionSeconds: activeSession.lastPosition,
		secondsListened: activeSession.secondsListened,
		endReason: reason ?? 'track_change',
		playbackContext: 'jellify',
	})

	activeSession = null
}

export function resetJellyMusicTelemetry(): void {
	activeSession = null
}

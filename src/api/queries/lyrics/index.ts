import { useQuery } from '@tanstack/react-query'
import LyricsQueryKey from './keys'
import { isUndefined } from 'lodash'
import { fetchRawLyrics } from './utils'
import { getApi } from '../../../stores/auth/utils'
import { useNowPlaying } from 'react-native-nitro-player'
import { ONE_DAY } from '../../../constants/query-client'

/**
 * Fetch lyrics for the currently playing track.
 *
 * Jellyfin remains the primary lyrics source.
 * Jelly Music is used only as a fallback when Jellyfin has no lyrics.
 */
const useRawLyrics = () => {
	const api = getApi()
	const { currentTrack } = useNowPlaying()

	return useQuery({
		queryKey: LyricsQueryKey(currentTrack),
		queryFn: ({ signal }) => fetchRawLyrics(api, currentTrack!, signal),
		enabled: !isUndefined(currentTrack),
		staleTime: (data) => (!isUndefined(data) ? ONE_DAY : 0),
	})
}

export default useRawLyrics

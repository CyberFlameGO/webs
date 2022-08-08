import {
  computed,
  defineComponent,
  FC,
  inject,
  InjectionKey,
  onBeforeMount,
  onMounted,
  provide,
  Ref,
  ref,
  watchEffect
} from 'vue';
import * as statsfm from '@statsfm/statsfm.js';
import dayjs from '../dayjs';
import { mdiCloudOffOutline, mdiEyeOff, mdiFileImportOutline } from '@mdi/js';
import { slugify } from '~/utils/slugify';

// components
import { Header } from '~/components/layout/Header';
import Container from '~/components/layout/Container.vue';
import Button from '~/components/base/Button.vue';
import { Avatar } from '~/components/base/Avatar';
import StickyHeader from '~/components/base/StickyHeader.vue';
import { Carousel } from '~/components/base/Carousel';
import { StatsCard, StatsCardSkeleton } from '~/components/base/StatsCard';
import { SegmentedControls } from '~/components/base/SegmentedControls';
import { TrackCard, TrackCardSkeleton } from '~/components/base/TrackCard';
import Icon from '~/components/base/Icon.vue';
import { TrackListRow, TrackListRowSkeleton } from '~/components/base/TrackListRow';
import { Skeleton } from '~/components/base/Skeleton';
import { Image } from '~/components/base/Image';
import { ArtistCard, ArtistCardSkeleton } from '~/components/base/ArtistCard';

// hooks
import { useApi, useAuth, useTitle, useUser } from '../hooks';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const UserContext: InjectionKey<Ref<statsfm.UserPublic>> = Symbol('UserContext');

const PrivacyScope: FC<{
  scope: keyof statsfm.UserPrivacySettings;
}> = ({ scope }, { slots }) => {
  const user = inject(UserContext);

  if (user?.value.privacySettings && user?.value.privacySettings[scope]) {
    return slots.default && slots.default();
  }

  return (
    <div class="grid w-full place-items-center">
      <Icon path={mdiEyeOff} />
      <p class="m-0 text-textGrey">{user?.value.displayName} doesn't share this</p>
    </div>
  );
};

const ImportRequiredScope: FC<{
  imported?: boolean;
}> = ({ imported = false }, { slots }) => {
  const user = inject(UserContext);
  const currentUser = useUser();

  if (imported) return slots.default && slots.default();

  // TODO: look for a better way to implement getting the user context
  if (user?.value.id == currentUser?.id || user?.value.id == 'me') {
    return (
      <div class="grid w-full place-items-center">
        <Icon path={mdiFileImportOutline} />
        {/* TODO: use i18n */}
        <p class="m-0 text-textGrey">
          this feature requires{' '}
          <RouterLink class="underline" to={{ name: 'Import' }}>
            import of streams
          </RouterLink>
        </p>
      </div>
    );
  }
};

const NotEnoughData: FC<{ data?: any[] }> = ({ data }, { slots }) => {
  if (data && data.length == 0) {
    return (
      <div class="grid w-full place-items-center">
        <Icon path={mdiCloudOffOutline} />
        <p class="m-0 text-textGrey">not enough data to calculate advanced stats</p>
      </div>
    );
  }

  return slots.default && slots.default();
};

const FriendStatusButton = defineComponent<{ userId: string }>(({ userId }) => {
  const api = useApi();
  const status = ref<statsfm.FriendStatus>();

  const loadUserFriend = async () => {
    status.value = await api.me.friendStatus(userId);
  };

  onMounted(loadUserFriend);

  const handleReloadFriendStatus = async () => {
    status.value = undefined;
    loadUserFriend();
  };

  return () => {
    switch (status.value) {
      case statsfm.FriendStatus.FRIENDS:
        return (
          <Button
            size="small"
            onClick={() => api.me.removeFriend(userId).then(handleReloadFriendStatus)}
          >
            Remove friend
          </Button>
        );
      case statsfm.FriendStatus.NONE:
        return (
          <Button
            size="small"
            onClick={() => api.me.sendFriendRequest(userId).then(handleReloadFriendStatus)}
          >
            Send friend request
          </Button>
        );
      case statsfm.FriendStatus.REQUEST_INCOMING:
        return (
          <Button
            size="small"
            onClick={() => api.me.acceptFriendRequest(userId).then(handleReloadFriendStatus)}
          >
            Accept friend request
          </Button>
        );
      case statsfm.FriendStatus.REQUEST_OUTGOING:
        return (
          <Button
            class="text-red-500"
            size="small"
            onClick={() => api.me.cancelFriendRequest(userId).then(handleReloadFriendStatus)}
          >
            Cancel friend request
          </Button>
        );
      default:
        return <Button size="small">Loading friendship...</Button>;
    }
  };
});

FriendStatusButton.props = ['userId'];

// const Indicator = defineComponent<{ indicator: statsfm.Indicator }>(({ indicator }) => {
//   return () => {
//     switch(indicator) {
//       case statsfm.Indicator.DOWN:
//         return (
//           // <Icon path={mdiSmall} />
//         )
//     }
//   }
// });

const PlusBadge = () => (
  <span class="rounded-md bg-primaryLighter px-1.5 py-0.5 text-sm text-primary">
    Spotistats Plus
  </span>
);

export default defineComponent(() => {
  const api = useApi();
  const auth = useAuth();
  // TODO: rename
  // the currently signed in user
  const currentUser = useUser();
  const router = useRouter();
  const route = useRoute();
  const { t } = useI18n();

  const user = ref<statsfm.UserPublic>();
  const stats = ref<{ label: string; value: string | number }[]>([]);
  const topTracks = ref<statsfm.TopTrack[]>();
  const topArtists = ref<statsfm.TopArtist[]>();
  const topAlbums = ref<statsfm.TopAlbum[]>();
  // const topGenres = ref<statsfm.TopGenre[]>();
  const recentStreams = ref<statsfm.RecentlyPlayedTrack[]>();

  const id = route.params.userId.toString();
  const isCurrentUser = computed(() => currentUser?.id == user.value?.id);
  const rangeRef = ref<statsfm.Range>(statsfm.Range.WEEKS);

  onBeforeMount(async () => {
    // TODO: show not found screen but stay on same route
    user.value = await api.users.get(id).catch(() => router.push({ name: 'NotFound' }));

    // TOOD: think of a better way of fetching based on privacy settings
    recentStreams.value = user.value?.privacySettings!.recentlyPlayed
      ? await api.users.recentlyStreamed(id)
      : [];

    // load data with weeks as default
    load(rangeRef.value);
  });

  provide(UserContext, user);

  const load = async (range: statsfm.Range) => {
    rangeRef.value = range;
    stats.value = [];

    topTracks.value = undefined;
    topArtists.value = undefined;
    topAlbums.value = undefined;

    // TODO: look for a better solution
    user.value?.privacySettings?.streamStats &&
      api.users.stats(id, { range }).then(({ durationMs, count }) => {
        stats.value.push(
          {
            label: t('user.streams'),
            value: count?.toLocaleString()
          },
          {
            label: t('user.minutes_streamed'),
            value: Math.round(dayjs.duration(durationMs).asMinutes()).toLocaleString()
          },
          {
            label: t('user.hours_streamed'),
            value: Math.round(dayjs.duration(durationMs).asHours()).toLocaleString()
          }
        );
      });

    topTracks.value = user.value?.privacySettings?.topTracks
      ? await api.users.topTracks(id, { range })
      : [];
    topArtists.value = user.value?.privacySettings?.topArtists
      ? await api.users.topArtists(id, { range })
      : [];
    topAlbums.value = user.value?.privacySettings?.topAlbums
      ? await api.users.topAlbums(id, { range })
      : [];
    // topGenres.value = user.value?.privacySettings?.topGenres
    //   ? await api.users.topGenres(id, { range })
    //   : [];
  };

  watchEffect(() => useTitle(user.value?.displayName));

  const onRangeSelect = (value: string) => {
    load(statsfm.Range[value.toUpperCase() as keyof typeof statsfm.Range]);
  };

  return () => (
    <>
      <Header />

      <Container class="flex flex-col items-center gap-5 pt-24 pb-10 md:flex-row">
        {user.value ? (
          <>
            <Avatar size="4xl" name={user.value.displayName} src={user.value.image} />

            <div class="flex flex-col justify-end">
              <span class="text-center text-lg font-medium md:text-left">
                {user.value.privacySettings?.profile && user.value.profile?.pronouns}{' '}
                {user.value.isPlus && <PlusBadge />}
              </span>
              <h1 class="text-center md:text-left">{user.value.displayName}</h1>
              {user.value.privacySettings?.profile && (
                <span class="text-center text-xl font-medium md:text-left">
                  {user.value.profile?.bio}
                </span>
              )}

              {/* TOOD: look why we can't use the custom id as id */}
              {auth.isLoggedIn() && !isCurrentUser.value && <FriendStatusButton class="mt-3" userId={user.value.id} />}

              {/* TODO: look if connections can be scoped (privacy) */}
              {/* <ul>
                {
                  // TODO: create a pull request to the statsfm library to add the social media connections to the `UserPublic` interface
                  (
                    user.value as statsfm.UserPublic & {
                      socialMediaConnections: statsfm.UserSocialMediaConnection[];
                    }
                  ).socialMediaConnections.map((connection) => (
                    <li>
                      <a href="/">
                        <img src={connection.platform.icon} alt={connection.platform.name} />
                      </a>
                    </li>
                  ))
                }
              </ul> */}
            </div>
          </>
        ) : (
          <>
            <Skeleton.Avatar size="4xl" />

            <div class="flex flex-col justify-end gap-2">
              <Skeleton.Text width="4rem" />
              <Skeleton.Text width="8rem" style={{ height: '1.75rem' }} />
              <Skeleton.Text width="18rem" />
            </div>
          </>
        )}
      </Container>

      <Container>
        <div class="my-8"></div>

        {/* stats */}
        <section class="flex flex-col justify-between gap-5 md:flex-row-reverse">
          <SegmentedControls
            class="w-1/8 h-max"
            segments={[
              { label: t('range.weeks'), value: statsfm.Range.WEEKS },
              { label: t('range.months'), value: statsfm.Range.MONTHS },
              { label: t('range.lifetime'), value: statsfm.Range.LIFETIME }
            ]}
            // TOOD: add emit type checking
            onSelect={(value) => onRangeSelect(value as unknown as string)}
          />

          <ImportRequiredScope imported={user.value?.hasImported}>
            <PrivacyScope scope="streamStats">
              <ul class="grid grid-cols-2 gap-4 md:grid-cols-4">
                {stats.value.length > 0
                  ? stats.value.map((item) => (
                      <li>
                        <StatsCard {...item} />
                      </li>
                    ))
                  : Array(3)
                      .fill(null)
                      .map(() => <StatsCardSkeleton />)}
              </ul>
            </PrivacyScope>
          </ImportRequiredScope>
        </section>

        {/* top tracks */}
        <StickyHeader>
          <div>
            <h2>{t('user.top_tracks.title')}</h2>
            <p class="my-1">
              {t('user.top_tracks.description', {
                // TODO: add name pluralization
                name: isCurrentUser.value ? 'Your' : user.value?.displayName,
                range: t(`range.${rangeRef.value}`)
              })}
            </p>
          </div>
        </StickyHeader>

        <section>
          <PrivacyScope scope="topTracks">
            <NotEnoughData data={topTracks.value}>
              <Carousel rows={1} gap={16}>
                {topTracks.value
                  ? topTracks.value.map((item) => (
                      <li>
                        <TrackCard {...item} />
                      </li>
                    ))
                  : Array(10)
                      .fill(null)
                      .map(() => (
                        <li>
                          <TrackCardSkeleton />
                        </li>
                      ))}
              </Carousel>
            </NotEnoughData>
          </PrivacyScope>
        </section>

        {/* top artists */}
        <StickyHeader>
          <div>
            <h2>{t('user.top_artists.title')}</h2>
            <p class="my-1">
              {t('user.top_artists.description', {
                name: isCurrentUser.value ? 'Your' : user.value?.displayName,
                range: t(`range.${rangeRef.value}`)
              })}
            </p>
          </div>
        </StickyHeader>

        <section>
          <PrivacyScope scope="topArtists">
            <NotEnoughData data={topArtists.value}>
              <Carousel rows={1} gap={16}>
                {topArtists.value
                  ? topArtists.value?.map((item) => (
                      <li>
                        <ArtistCard {...item} />
                      </li>
                    ))
                  : Array(10)
                      .fill(null)
                      .map(() => (
                        <li>
                          <ArtistCardSkeleton />
                        </li>
                      ))}
              </Carousel>
            </NotEnoughData>
          </PrivacyScope>
        </section>

        {/* top albums */}
        <StickyHeader>
          <div>
            <h2>{t('user.top_albums.title')}</h2>
            <p class="my-1">
              {t('user.top_albums.description', {
                name: isCurrentUser.value ? 'Your' : user.value?.displayName,
                range: t(`range.${rangeRef.value}`)
              })}
            </p>
          </div>
        </StickyHeader>

        <section>
          <PrivacyScope scope="topAlbums">
            <NotEnoughData data={topAlbums.value}>
              <Carousel rows={1} gap={16}>
                {topAlbums.value
                  ? topAlbums.value?.map((item) => (
                      // TODO: move to separate component
                      <li>
                        <RouterLink
                          to={{
                            name: 'Album',
                            params: { id: item.album.id, slug: slugify(item.album.name) }
                          }}
                        >
                          <div class="w-40">
                            <div class="min-h-50 aspect-square w-full group-hover:opacity-90">
                              <Image
                                key={item.album.image}
                                src={item.album.image}
                                alt={item.album.name}
                                class="aspect-square"
                              />
                            </div>
                            <div class="mt-2">
                              <h4 class="line-clamp-2">{item.album.name}</h4>
                              <p class="m-0 truncate">
                                {t('minutes', {
                                  count: Math.floor(
                                    dayjs.duration(item.playedMs!, 'ms').asMinutes()
                                  ).toLocaleString()
                                })}{' '}
                                • {t('streams', { count: item.streams })}
                              </p>
                            </div>
                          </div>
                        </RouterLink>
                      </li>
                    ))
                  : Array(10)
                      .fill(null)
                      .map(() => (
                        <li>
                          <Skeleton.Image width="10rem" height="10rem" />
                          <div class="mt-2 flex flex-col gap-2">
                            <Skeleton.Text width="9rem" />
                            <Skeleton.Text width="6.5rem" />
                          </div>
                        </li>
                      ))}
              </Carousel>
            </NotEnoughData>
          </PrivacyScope>
        </section>

        {/* recent streams */}
        <StickyHeader>
          <div>
            <h2>{t('user.recent_streams.title')}</h2>
            <p class="my-1">
              {t('user.recent_streams.description', {
                name: isCurrentUser.value ? 'Your' : user.value?.displayName
              })}
            </p>
          </div>
        </StickyHeader>

        <section>
          <PrivacyScope scope="recentlyPlayed">
            <NotEnoughData data={recentStreams.value}>
              {/* TOOD: replace this with a recently streamed ui */}
              {recentStreams.value?.length! > 0
                ? recentStreams.value?.map((item) => <TrackListRow {...item} />)
                : Array(8)
                    .fill(null)
                    .map(() => <TrackListRowSkeleton />)}
            </NotEnoughData>
          </PrivacyScope>
        </section>
      </Container>
    </>
  );
});

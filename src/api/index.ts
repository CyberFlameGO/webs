import NProgress from 'nprogress';
import i18n from '~/i18n';
import { BacktrackAlbum, BacktrackArtist, BacktrackTrack } from '~/types';
import * as toaster from '../components/base/Toaster/api';

export interface Response<T = any> {
  success: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: any;
  data: any;
}

export default class Api {
  http: ApiManager;

  tracks: TrackManager;

  albums: AlbumManager;

  artists: ArtistManager;

  users: UserManager;

  constructor() {
    this.http = new ApiManager();
    this.tracks = new TrackManager();
    this.albums = new AlbumManager();
    this.artists = new ArtistManager();
    this.users = new UserManager();
  }
}

export class ApiManager {
  static baseUrl: string = 'https://aart.backtrack.dev/api/v1';

  constructor() {}

  /**
   * @param  {string} slug
   * @param  {RequestInit} init?
   * @returns {Promise<Response>} Returns a promise with the {@link Response response}.
   */
  async request<T>(slug: string, init?: RequestInit): Promise<Response<T>> {
    init = {
      ...init,
      headers: {
        Authorization: `${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        ...init?.headers
      }
    };

    // @ts-ignore
    if (init.headers['Content-Type'] == null) {
      // @ts-ignore
      delete init.headers['Content-Type'];
    }

    NProgress.start();

    const res = await fetch(`${ApiManager.baseUrl}${slug}`, init);
    const newRes: Response = {
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      headers: res.headers,
      data: await res.json()
    };

    NProgress.done();
    if (!newRes.success) {
      switch (newRes.status) {
        case 403:
          toaster.error({ message: i18n.global.t('errors.not_authenticated') });
          break;
        default:
          toaster.error({
            message: newRes.data.message
          });
      }
    }

    return newRes;
  }

  /**
   * @param  {string} slug
   * @param  {RequestInit} options?
   * @returns {Promise<Response>} Returns a promise with the {@link Response response}.
   */
  async httpGet<T>(slug: string, options?: RequestInit): Promise<Response<T>> {
    return await this.request<T>(slug, {
      ...options,
      method: 'GET'
    });
  }

  /**
   * @param  {string} slug
   * @param  {RequestInit} options?
   * @returns {Promise<Response>} Returns a promise with the {@link Response response}.
   */
  async httpPost<T>(slug: string, options?: RequestInit): Promise<Response<T>> {
    return await this.request<T>(slug, {
      ...options,
      method: 'POST'
    });
  }

  /**
   * @param  {string} slug
   * @param  {RequestInit} options?
   * @returns {Promise<Response>} Returns a promise with the {@link Response response}.
   */
  async httpPut<T>(slug: string, options?: RequestInit): Promise<Response<T>> {
    return await this.request<T>(slug, {
      ...options,
      method: 'PUT'
    });
  }

  /**
   * @param  {string} slug
   * @param  {RequestInit} options?
   * @returns {Promise<Response>} Returns a promise with the {@link Response response}.
   */
  async httpDelete<T>(slug: string, options?: RequestInit): Promise<Response<T>> {
    return await this.request<T>(slug, {
      ...options,
      method: 'DELETE'
    });
  }
}

export class TrackManager extends ApiManager {
  /**
   * @description Get a track by ID.
   * @param {number} id The ID of the track.
   * @returns {Promise<BacktrackTrack>} Returns a promise with a single {@link BacktrackTrack}.
   */
  async get(id: number): Promise<BacktrackTrack> {
    const res = await this.httpGet(`/tracks/${id}`);

    return res.data.item as BacktrackTrack;
  }

  /**
   * @description Get a list of tracks by IDs.
   * @param {number} ids The IDs of the tracks.
   * @returns {Promise<BacktrackTrack[]>} Returns a promise with a single {@link BacktrackTrack}.
   */
  async list(ids: number[]): Promise<BacktrackTrack[]> {
    const res = await this.httpGet(`/tracks/list?ids=${ids.join(',')}`);

    return res.data.items as BacktrackTrack[];
  }
}
export class ArtistManager extends ApiManager {
  /**
   * @description Get a artist by ID.
   * @param {number} id The ID of the artist.
   * @returns {Promise<BacktrackArtist>} Returns a promise with a single {@link BacktrackArtist}.
   */
  async get(id: number): Promise<BacktrackArtist> {
    const res = await this.httpGet(`/artists/${id}`);

    return res.data.item as BacktrackArtist;
  }

  /**
   * @description Get a list of artists by IDs.
   * @param {number} id The IDs of the track.
   * @returns {Promise<BacktrackArtist[]>} Returns a promise with a {@link BacktrackArtist}s.
   */
  async list(ids: number[]): Promise<BacktrackArtist[]> {
    const res = await this.httpGet(`/artists/list?ids=${ids.join(',')}`);

    return res.data.items as BacktrackArtist[];
  }

  /**
   * @description Get a list of tracks by the artist ID.
   * @param {number} id The IDs of the artist.
   * @returns {Promise<BacktrackTrack[]>} Returns a promise with a {@link BacktrackTrack[]}s.
   */
  async tracks(id: number) {
    const res = await this.httpGet(`/artists/${id}/tracks`);

    return res.data.items as BacktrackTrack[];
  }
}
export class AlbumManager extends ApiManager {
  /**
   * @description Get a album by ID.
   * @param {number} id The ID of the album.
   * @returns {Promise<BacktrackAlbum>} Returns a promise with a single {@link BacktrackAlbum}.
   */
  async get(id: number): Promise<BacktrackAlbum> {
    const res = await this.httpGet(`/albums/${id}`);

    return res.data.item as BacktrackAlbum;
  }

  /**
   * @description Get a list of albums by IDs.
   * @param {string} id The IDs of the albums
   * * @returns {Promise<BacktrackAlbum[]>} Returns a promise with a {@link BacktrackAlbum}s.
   
   */
  async list(ids: number[]): Promise<BacktrackAlbum[]> {
    const res = await this.httpGet(`/albums/list?ids=${ids.join(',')}`);

    return res.data.items as BacktrackAlbum[];
  }

  /**
   * @description Get a list of tracks on the album.
   * @param {number} id The IDs of the album.
   * @returns {Promise<BacktrackTrack[]>} Returns a promise with a {@link BacktrackTrack[]}s.
   */
  async tracks(id: number) {
    const res = await this.httpGet(`/albums/${id}/tracks`);

    return res.data.items as BacktrackTrack[];
  }
}
export class UserManager extends ApiManager {
  async get(id: string) {
    const res = await this.httpGet(`/users/${id}`);

    return res.data.item;
  }

  async getStreams(id: string) {
    const res = await this.httpGet(`/users/${id}/streams`);

    return res.data.items;
  }

  async getRecentStreams(id: string) {
    const res = await this.httpGet(`/users/${id}/streams/recent`);

    return res.data.items;
  }

  async getCount(id: string) {
    const res = await this.httpGet(`/users/${id}/streams/count`);

    return res.data.item;
  }

  async getDuration(id: string) {
    const res = await this.httpGet(`/users/${id}/streams/duration`);

    return res.data.item;
  }

  async getTrackStreams(id: string, trackId: number) {
    const res = await this.httpGet(`/users/${id}/streams/tracks/${trackId}`);

    return res.data.items;
  }

  async getTrackCount(id: string, trackId: number) {
    const res = await this.httpGet(`/users/${id}/streams/tracks/${trackId}/count`);

    return res.data.item;
  }

  async getTrackDuration(id: string, trackId: number) {
    const res = await this.httpGet(`/users/${id}/streams/tracks/${trackId}/duration`);

    return res.data.item;
  }

  async getArtistStreams(id: string, artistId: number) {
    const res = await this.httpGet(`/users/${id}/streams/artists/${artistId}`);

    return res.data.items;
  }

  async getArtistCount(id: string, artistId: number) {
    const res = await this.httpGet(`/users/${id}/streams/artists/${artistId}/count`);

    return res.data.item;
  }

  async getArtistDuration(id: string, artistId: number) {
    const res = await this.httpGet(`/users/${id}/streams/artists/${artistId}/duration`);

    return res.data.item;
  }

  async getAlbumStreams(id: string, albumId: number) {
    const res = await this.httpGet(`/users/${id}/streams/albums/${albumId}`);

    return res.data.items;
  }

  async getAlbumCount(id: string, albumId: number) {
    const res = await this.httpGet(`/users/${id}/streams/albums/${albumId}/count`);

    return res.data.item;
  }

  async getAlbumDuration(id: string, albumId: number) {
    const res = await this.httpGet(`/users/${id}/streams/albums/${albumId}/duration`);

    return res.data.item;
  }

  async getTopTracks(id: string) {
    const res = await this.httpGet(`/users/${id}/top/tracks`);

    return res.data.items;
  }

  async getTopArtists(id: string) {
    const res = await this.httpGet(`/users/${id}/top/artists`);

    return res.data.items;
  }

  async getTopTracksFromArtist(id: string, artistId: number) {
    const res = await this.httpGet(`/users/${id}/top/artists/${artistId}/tracks`);

    return res.data.items;
  }

  async getTopAlbumsFromArtist(id: string, artistId: number) {
    const res = await this.httpGet(`/users/${id}/top/artists/${artistId}/albums`);

    return res.data.items;
  }

  async getTopAlbums(id: string) {
    const res = await this.httpGet(`/users/${id}/top/albums`);

    return res.data.items;
  }

  async getTopTracksFromAlbums(id: string, albumId: number) {
    const res = await this.httpGet(`/users/${id}/top/albums/${albumId}/tracks`);

    return res.data.items;
  }
}

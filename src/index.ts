// import

import type {ParsedUrlQueryInput} from 'querystring';
import qs from 'querystring';

import 'abort-controller/polyfill';
import 'isomorphic-unfetch';
import retry from 'promise-retry';
import * as R from 'ramda';

// types

export type ResponseType = 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

export type ResponseBody<T> =
  T extends 'json' ? any :
  T extends 'text' ? string :
  T extends 'blob' ? Blob :
  T extends 'formData' ? FormData :
  T extends 'arrayBuffer' ? ArrayBuffer :
  never;

export interface RequestResponse<T extends ResponseType> {
  status: number;
  headers: Headers;
  body: ResponseBody<T>;
}

export type Fetcher<T = any> = () => Promise<T>;
export type Adaptor = <T = any>(fetcher: Fetcher<T>) => Promise<T>;

export interface RequestOpts extends RequestInit {
  baseUrl?: string;
  path?: string;
  body?: any;
  query?: ParsedUrlQueryInput;

  useJson?: boolean;
  useCors?: boolean;
  sameOrigin?: boolean | string;

  response?: ResponseType;
  onlyBody?: boolean;
  timeout?: number;

  adaptors?: Adaptor | Adaptor[];
}

export interface RequestError<T extends ResponseType> extends Error {
  url: string;
  body: unknown;
  request: RequestInit;
  response: RequestResponse<T>;
}

export interface Request {
  <T = any>(
    pathOrOpts: RequestOpts | string,
    maybeOpts?: RequestOpts,
  ): Promise<T>;
}

export interface RequestExt extends Request {
  extend: (newDefs?: RequestOpts) => RequestExt;
}

type RetryOpts = Parameters<typeof retry>[0];

// vars

const retryDefs: RetryOpts = {
  retries: 0,
  factor: 1.5,
  minTimeout: 500,
  maxTimeout: Infinity,
  randomize: false,
};

const endSlashRx = /\/$/;
const startSlashRx = /^\//;

// fns

const nil = () => null;

export const mergeRequestOpts = (
  pathOrOpts: RequestOpts | string,
  maybeOpts?: RequestOpts,
): RequestOpts => (
  typeof pathOrOpts === 'string' ?
    {path: pathOrOpts, ...maybeOpts} :
    pathOrOpts
);

export const createRetryAdaptor = (retryOpts: RetryOpts = {}): Adaptor =>
  async (fetcher) => retry(
    async (retryFn) => fetcher().catch(retryFn),
    {...retryDefs, ...retryOpts},
  );

// export

export function createRequest(defs: RequestOpts = {}) {
  const request: RequestExt = async <T = any>(
    pathOrOpts: RequestOpts | string,
    maybeOpts?: RequestOpts,
  ): Promise<T> => {
    const opts = mergeRequestOpts(pathOrOpts, maybeOpts);

    const {
      baseUrl, path, query, body, headers,
      useJson = false, useCors = false, sameOrigin = false,
      response: responseType = 'json', onlyBody = false,
      timeout = 0, adaptors,
      ...rest
    } = R.mergeDeepRight(defs, opts) as RequestOpts;

    const realAdaptors = (
      Array.isArray(adaptors) ? adaptors :
      adaptors ? [adaptors] : []
    ).filter(Boolean);

    const reqUrl = [
      ...baseUrl ? [baseUrl.replace(endSlashRx, ''), '/'] : [],
      path?.replace(startSlashRx, ''),
      ...query ? ['?', qs.stringify(query)] : [],
    ].join('');

    const reqOpts: RequestInit = {
      method: body ? 'POST' : 'GET',
      body: body ? useJson ? JSON.stringify(body) : body : undefined,
      mode: sameOrigin ? 'same-origin' : useCors ? 'cors' : 'no-cors',
      credentials: sameOrigin ? 'same-origin' : useCors ? 'omit' : 'include',
      ...rest,
      headers: {
        ...(useJson ? {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        } : {}),
        ...(useCors ? {
          'Access-Control-Allow-Origin': '*',
        } : {}),
        ...(R.is(String, sameOrigin) ? {
          'Access-Control-Allow-Origin': sameOrigin as string,
        } : {}),
        ...headers,
      },
    };

    const fetcher: Fetcher<T> = async () => {
      let ctrl: AbortController | null = null;

      if (timeout) {
        ctrl = new AbortController();
        setTimeout(() => ctrl?.abort(), timeout);
      }

      const theseOpts = ctrl ?
        {...reqOpts, signal: ctrl.signal} : reqOpts;

      const res = await fetch(reqUrl, theseOpts);

      const parsedBody: ResponseBody<typeof responseType> =
        await res[responseType]().catch(nil);

      const response: RequestResponse<typeof responseType> = {
        status: res.status,
        headers: res.headers,
        body: parsedBody,
      };

      if (!res.ok) {
        const err = new Error(
          parsedBody?.message ?? `${res.status} ${res.statusText}`,
        ) as RequestError<typeof responseType>;

        err.body = parsedBody;
        err.response = response;

        throw err;
      }

      return onlyBody ? parsedBody : response;
    };

    try {
      return await realAdaptors.reduce<Fetcher>((f, adaptor) => {
        return async () => adaptor<T>(f);
      }, fetcher)();
    } catch (err) {
      err.url = reqUrl;
      err.request = reqOpts;

      throw err;
    }
  };

  request.extend = (newDefs: RequestOpts = {}) =>
    createRequest(R.mergeDeepRight(defs, newDefs) as RequestOpts);

  return request;
}

export const request = createRequest();

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

export interface RequestOpts extends RequestInit {
  baseUrl?: string;
  path?: string;
  body?: any;
  query?: ParsedUrlQueryInput;

  useJson? : boolean;
  useCors? : boolean;
  sameOrigin?: boolean | string;

  response?: ResponseType;
  onlyBody?: boolean;

  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  randomize? : boolean;

  timeout? : number;
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

// vars

const retryDefs = {
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

// export

function createRequest(defs: RequestOpts = {}) {
  console.log(defs);

  const request: RequestExt = async (pathOrOpts, maybeOpts) => {
    const opts = mergeRequestOpts(pathOrOpts, maybeOpts);
    console.log('enter', pathOrOpts);

    const {
      baseUrl, path, query, body, headers,
      retries, factor, minTimeout, maxTimeout, randomize,
      useJson = false, useCors = false, sameOrigin = false,
      response: responseType = 'json', onlyBody = false,
      timeout = 0,
      ...rest
    } = R.mergeDeepRight(defs, opts) as RequestOpts;

    const retryOpts = {
      ...retryDefs,
      retries,
      factor,
      minTimeout,
      maxTimeout,
      randomize,
    };

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

    console.log(reqOpts.method, reqUrl);

    try {
      const res = await retry(async (retryFn) => {
        let ctrl: AbortController | null = null;

        if (timeout) {
          ctrl = new AbortController();
          setTimeout(() => ctrl?.abort(), timeout);
        }

        const theseOpts = ctrl ?
          {...reqOpts, signal: ctrl.signal} : reqOpts;

        console.log('in retry', reqUrl);

        return fetch(reqUrl, theseOpts).catch(retryFn);
      }, retryOpts);

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

export default createRequest();

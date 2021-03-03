/* eslint-disable @typescript-eslint/naming-convention */

// import

import type {ParsedUrlQueryInput} from 'querystring';
import {stringify} from 'querystring';

import retry from 'promise-retry';
import * as R from 'ramda';

// types

export interface ReqOpts extends RequestInit {
  baseUrl?: string;
  path?: string;

  query?: ParsedUrlQueryInput;

  // helpers
  useJson?: boolean;
  useCors?: boolean;
  sameOrigin?: boolean;
  onlyBody?: boolean;
  response?: 'arrayBuffer' | 'blob' | 'formData' | 'json' | 'text';

  // timing
  timeout?: number;
  throttle?: number;

  // retries
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  randomize?: boolean;
}

export interface ParsedResponse {
  [index: string]: unknown;
  status: number;
  statusText: string;
  headers: Headers;
  body: unknown;
}

export interface ReqError extends Error {
  url?: string;
  request?: RequestInit;
  response?: ParsedResponse;
}

type BodyResponseType = keyof Omit<Body, 'body' | 'bodyUsed'>

interface MessageObj {
  [index: string]: unknown;
  message: string;
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
const isString = R.is(String);

const delay = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const encodeUrl = (
  baseUrl: string | undefined,
  path: string | undefined,
  query: ParsedUrlQueryInput | undefined,
) => [
  baseUrl?.replace(endSlashRx, ''),
  baseUrl && '/',
  path?.replace(startSlashRx, ''),
  query && '?',
  query && stringify(query),
].filter(Boolean).join('');

const encodeBody = (body: BodyInit | null | undefined, useJson: boolean) => (
  body ? useJson ? JSON.stringify(body) : body : undefined
);

const parseRes = (type: BodyResponseType) =>
  async (res: Response) => {
    const response: ParsedResponse = {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      body: await res[type]().catch(nil),
    };

    if (!res.ok) {
      const err: ReqError = new Error(
        (response.body as MessageObj)?.message ??
        `${res.status} ${res.statusText}`,
      );
      err.response = response;
      throw err;
    }

    return response;
  };

const parseType = {
  json: parseRes('json'),
  text: parseRes('text'),
  blob: parseRes('blob'),
  formData: parseRes('formData'),
  arrayBuffer: parseRes('arrayBuffer'),
};

const parseErr = (url: string, request: RequestInit) =>
  (err: ReqError) => {
    err.url = url;
    err.request = request;
    throw err;
  };

const getBody = (res: ParsedResponse) => res.body ?? null;
const getAll = (res: ParsedResponse) => res ?? null;

// export

function createRequest(defs: ReqOpts = {}) {
  async function request(pathOrOpts: ReqOpts | string, maybeOpts: ReqOpts = {}) {
    const opts = isString(pathOrOpts) ?
      {path: pathOrOpts as string, ...maybeOpts} :
      pathOrOpts as ReqOpts;
    const {
      baseUrl, path, query, body, headers,
      retries, factor, minTimeout, maxTimeout, randomize,
      useJson = false, useCors = false, sameOrigin = false,
      response = 'json', onlyBody = false,
      timeout = 0, throttle = 0,
      ...rest
    } = R.mergeDeepRight(defs, opts);

    const retryOpts = {
      ...retryDefs,
      retries,
      factor,
      minTimeout,
      maxTimeout,
      randomize,
    };

    const reqUrl = encodeUrl(baseUrl, path, query as ParsedUrlQueryInput);

    const reqOpts: RequestInit = {
      method: body ? 'POST' : 'GET',
      body: encodeBody(body, useJson),
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
          'Access-Control-Allow-Origin': sameOrigin,
        } : {}),
        ...headers as Headers,
      },
    };

    return retry(async (retryFn) => {
      let ctrl: AbortController | null = null;

      if (throttle) {
        // TODO: Make this actually throttle!
        await delay(throttle);
      }

      if (timeout) {
        ctrl = new AbortController();
        setTimeout(() => ctrl?.abort(), timeout);
      }

      const finalOpts = ctrl ?
        {...reqOpts, signal: ctrl.signal} :
        reqOpts;

      return fetch(reqUrl, finalOpts).catch(retryFn);
    }, retryOpts)
      .then(parseType[response])
      .then(onlyBody ? getBody : getAll)
      .catch(parseErr(reqUrl, reqOpts));
  }

  request.extend = (moreDefs: ReqOpts = {}) =>
    createRequest(R.mergeDeepRight(defs, moreDefs) as ReqOpts);

  return request;
}

export default createRequest();

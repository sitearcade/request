// import

import qs from 'querystring';

import 'abort-controller/polyfill';
import 'isomorphic-unfetch';
import retry from 'promise-retry';
import {mergeDeepRight, is} from 'ramda';

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

const encodeUrl = (baseUrl = '', path = '', query = null) => [
  ...baseUrl ? [baseUrl.replace(endSlashRx, ''), '/'] : [],
  path.replace(startSlashRx, ''),
  ...query ? ['?', qs.stringify(query)] : [],
].join('');

const encodeBody = (body, useJson) => (
  body ? useJson ? JSON.stringify(body) : body : undefined
);

const parseRes = (type) => async (res) => {
  const response = {
    status: res.status,
    headers: res.headers,
    body: await res[type]().catch(nil),
  };

  if (!res.ok) {
    const err = new Error(response?.body?.message ?? `${res.status} ${res.statusText}`);
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

const parseErr = (url, opts) => (err) => {
  err.request = {url, ...opts};
  throw err;
};

const getBody = (res) => res.body ?? null;
const getAll = (res) => res ?? null;

// export

export default async function request(maybePath, maybeOpts) {
  const {
    baseUrl, path, query, body, headers,
    retries, factor, minTimeout, maxTimeout, randomize,
    useJson = false, useCors = false, sameOrigin = false,
    response = 'json', onlyBody = false,
    timeout = 0,
    ...rest
  } = maybeOpts || maybePath;
  const ms = parseInt(timeout) || 0;

  const retryOpts = {
    ...retryDefs,
    retries,
    factor,
    minTimeout,
    maxTimeout,
    randomize,
  };

  const reqUrl = encodeUrl(baseUrl, path || maybePath, query);

  const reqOpts = {
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
      ...(is(String, sameOrigin) ? {
        'Access-Control-Allow-Origin': sameOrigin,
      } : {}),
      ...headers,
    },
  };

  return retry((retryFn) => {
    let ctrl = null;

    if (ms) {
      ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), ms);
    }

    return fetch(reqUrl, ctrl ? {...reqOpts, signal: ctrl.signal} : reqOpts).catch(retryFn);
  }, retryOpts)
    .then(parseType[response])
    .then(onlyBody ? getBody : getAll)
    .catch(parseErr(reqUrl, reqOpts));
}

request.extend = (defs = {}) => (maybePath, maybeOpts) =>
  request(mergeDeepRight(
    defs,
    maybeOpts ? {...maybeOpts, path: maybePath} :
    typeof maybePath === 'object' ? maybePath :
    {path: maybePath},
  ));

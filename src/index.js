// import

import qs from 'querystring';

import fetch from 'isomorphic-unfetch';
import retry from 'promise-retry';
import R from 'ramda';

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

const encodeUrl = (baseUrl = '', path = '', query = null) => [
  ...baseUrl ? [baseUrl.replace(endSlashRx, ''), '/'] : [],
  path.replace(startSlashRx, ''),
  ...query ? ['?', qs.stringify(query)] : [],
].join('');

const encodeBody = (body, useJson) => (
  body ? useJson ? JSON.stringify(body) : body : undefined
);

const parseRes = (type) => async (res) => {
  const parsed = {
    status: res.status,
    headers: res.headers,
    body: await res[type]().catch(R.always(null)),
  };

  if (!res.ok) {
    // eslint-disable-next-line fp/no-mutating-assign
    throw Object.assign(
      new Error(parsed?.body?.message ?? `${res.status} ${res.statusText}`),
      {parsed},
    );
  }

  return parsed;
};

const parseType = {
  json: parseRes('json'),
  text: parseRes('text'),
  blob: parseRes('blob'),
  formData: parseRes('formData'),
  arrayBuffer: parseRes('arrayBuffer'),
};

const getBody = R.prop('body');

// export

export default async function request(opts = {}) {
  const {
    baseUrl, path, query, body, headers,
    retries, factor, minTimeout, maxTimeout, randomize,
    useJson = false, useCors = false,
    response = 'json', onlyBody = false,
    ...rest
  } = opts;

  const retryOpts = {
    ...retryDefs,
    retries,
    factor,
    minTimeout,
    maxTimeout,
    randomize,
  };

  const reqUrl = encodeUrl(baseUrl, path, query);

  const reqOpts = {
    method: body ? 'POST' : 'GET',
    body: encodeBody(body, useJson),
    credentials: useCors ? undefined : 'include',
    ...rest,
    headers: {
      ...(useJson ? {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      } : {}),
      ...(useCors ? {
        'Access-Control-Allow-Origin': '*',
      } : {}),
      ...headers,
    },
  };

  return retry((retryFn) => (
    fetch(reqUrl, reqOpts).catch(retryFn)
  ), retryOpts)
    .then(parseType[response])
    .then(onlyBody ? getBody : R.identity);
}

request.extend = (defs = {}) => (opts) =>
  request(R.mergeDeepRight(defs, opts));

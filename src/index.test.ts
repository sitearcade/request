// import

import {fetchMock} from '@sitearcade/jest-preset/tools';
import * as R from 'ramda';

import request from './index';

// vars

const sampleRes = {status: 'ok'};
const mock = fetchMock.default;

// test

beforeAll(() => {
  fetchMock.enableFetchMocks();
});

describe('request(opts)', () => {
  it('sends request and receives response using default opts', async () => {
    mock.once(JSON.stringify(sampleRes));
    const res = await request({path: 'https://www.example.com'});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });

  it('returns errors with a certain shape', async () => {
    mock.once(JSON.stringify(sampleRes), {status: 404});
    const err = await request({path: 'https://www.error.com'})
      .catch(R.identity);

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
      Object {
        "body": undefined,
        "credentials": "include",
        "headers": Object {},
        "method": "GET",
        "mode": "no-cors",
      }
    `);
    expect(err.response).toMatchInlineSnapshot(`
        Object {
          "body": Object {
            "status": "ok",
          },
          "headers": Headers {
            Symbol(map): Object {
              "Content-Type": Array [
                "text/plain;charset=UTF-8",
              ],
            },
          },
          "status": 404,
        }
      `);
  });
});

describe('request(url, opts)', () => {
  it('supports alternative signature', async () => {
    mock.once(JSON.stringify(sampleRes));
    const res = await request('https://www.example.com', {body: {}});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });

  it('handles AbortSignal properly', async () => {
    const c = new AbortController();

    const res = await request('/', {signal: c.signal});

    expect(res.body).toBeNull();

    c.abort();

    const err = await request('/', {signal: c.signal}).catch(R.identity);

    expect(err).toMatchInlineSnapshot(
      '[AbortError: The operation was aborted. ]',
    );
  });

  it('can timeout after specific duration', async () => {
    jest.useFakeTimers();

    mock.once(JSON.stringify(sampleRes));
    const t0 = await request('https://www.example.com', {
      useJson: true,
      timeout: 0,
    });

    expect(t0).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);

    mock.once(async () => {
      jest.advanceTimersByTime(10);

      return JSON.stringify(sampleRes);
    });
    const t1 = await request('https://www.example.com', {
      useJson: true,
      timeout: 1,
    }).catch(R.identity);

    expect(t1).toMatchInlineSnapshot(
      '[AbortError: The operation was aborted. ]',
    );

    jest.useRealTimers();
  });
});

describe('request.extend(defs)', () => {
  it('creates new requester with updated defaults', async () => {
    const req = request.extend({
      useJson: true,
      useCors: true,
      onlyBody: true,
    });

    mock.once(JSON.stringify(sampleRes));
    const res = await req({path: 'https://www.example.com'});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "status": "ok",
      }
    `);

    mock.once(JSON.stringify(sampleRes), {status: 404});
    const err = await req({path: 'https://www.error.com'}).catch(R.identity);

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
      Object {
        "body": undefined,
        "credentials": "omit",
        "headers": Object {
          "Accept": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        "method": "GET",
        "mode": "cors",
      }
    `);
    expect(err.response).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 404,
      }
    `);
  });

  it('also supports alternative signature', async () => {
    const req = request.extend();

    mock.once(JSON.stringify(sampleRes));
    const res = await req('https://www.example.com');

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);

    mock.once(JSON.stringify(sampleRes));
    const altRes = await req('https://www.example.com', {useJson: true});

    expect(altRes).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });
});

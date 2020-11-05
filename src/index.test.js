// import

import {fetchMock} from '@sitearcade/jest-preset/tools';
import {identity} from 'ramda';

import request from './index';

// vars

const sampleRes = {status: 'ok'};

// test

beforeAll(() => {
  fetchMock.enableMocks();
});

describe('request(opts)', () => {
  it('sends request and receives response using default opts', async () => {
    fetch.once(JSON.stringify(sampleRes));
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
    fetch.once(JSON.stringify(sampleRes), {ok: false, status: 404});
    const err = await request({path: 'https://www.error.com'}).catch(
      identity,
    );

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
        Object {
          "body": undefined,
          "credentials": "include",
          "headers": Object {},
          "method": "GET",
          "url": "https://www.error.com",
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

describe('request.extend(defs)', () => {
  it('creates new requester with updated defaults', async () => {
    const req = request.extend({
      useJson: true,
      useCors: true,
      onlyBody: true,
    });

    fetch.once(JSON.stringify(sampleRes));
    const res = await req({path: 'https://www.example.com'});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "status": "ok",
      }
    `);

    fetch.once(JSON.stringify(sampleRes), {ok: false, status: 404});
    const err = await req({path: 'https://www.error.com'}).catch(identity);

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
      Object {
        "body": undefined,
        "credentials": undefined,
        "headers": Object {
          "Accept": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        "method": "GET",
        "url": "https://www.error.com",
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

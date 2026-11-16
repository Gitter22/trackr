import request from 'supertest';
import { createApp } from '../app';
import { env } from '../config/env';

const app = createApp();

/** supertest agent that looks like it came through the proxy for the given host. */
export function api(host: string, tenantSlug = '') {
  const agent = request.agent(app);
  const withHeaders = <T extends request.Test>(t: T) =>
    t.set('Host', host).set('X-Proxy-Secret', env().PROXY_SECRET).set('X-Tenant-Slug', tenantSlug);
  return {
    agent,
    get: (url: string) => withHeaders(agent.get(url)),
    post: (url: string) => withHeaders(agent.post(url)),
    patch: (url: string) => withHeaders(agent.patch(url)),
    delete: (url: string) => withHeaders(agent.delete(url)),
  };
}

export const adminHost = () => `admin.${env().APP_DOMAIN}`;

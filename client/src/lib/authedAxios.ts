import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

export type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;


function withAuthorizationHeader(headers: AxiosRequestConfig['headers'], token: string | null) {
  if (!token) {
    return headers;
  }

  return {
    ...(headers ?? {}),
    Authorization: `Bearer ${token}`,
  };
}


export async function authedRequest<T>(
  getToken: TokenGetter,
  config: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  let token = await getToken();

  try {
    return await axios.request<T>({
      ...config,
      headers: withAuthorizationHeader(config.headers, token),
    });
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw error;
    }

    token = await getToken({ skipCache: true });
    return await axios.request<T>({
      ...config,
      headers: withAuthorizationHeader(config.headers, token),
    });
  }
}


export function authedGet<T>(
  getToken: TokenGetter,
  url: string,
  config: AxiosRequestConfig = {},
) {
  return authedRequest<T>(getToken, {
    ...config,
    method: 'get',
    url,
  });
}


export function authedPost<T>(
  getToken: TokenGetter,
  url: string,
  data?: unknown,
  config: AxiosRequestConfig = {},
) {
  return authedRequest<T>(getToken, {
    ...config,
    method: 'post',
    url,
    data,
  });
}


export function authedDelete<T>(
  getToken: TokenGetter,
  url: string,
  config: AxiosRequestConfig = {},
) {
  return authedRequest<T>(getToken, {
    ...config,
    method: 'delete',
    url,
  });
}
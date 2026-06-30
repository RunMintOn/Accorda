import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

let configured = false

export function configureProxyFromEnv() {
  if (configured) return
  configured = true

  setGlobalDispatcher(
    new EnvHttpProxyAgent({
      allowH2: false,
      bodyTimeout: 300_000,
      headersTimeout: 300_000,
    }),
  )
}

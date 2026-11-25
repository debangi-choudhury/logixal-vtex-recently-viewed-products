import React from 'react'
import { render } from '@testing-library/react'
import { createIntl, IntlProvider } from 'react-intl'

const Intl = ({ children }: { children?: React.ReactNode }) => (
  <IntlProvider locale="en-US" timeZone="UTC" onError={() => {}}>
    {children}
  </IntlProvider>
)

/**
 * Renders with the messages' default English texts. A rerender keeps the
 * provider, so components update instead of mounting again.
 */
export function renderWithIntl(ui: React.ReactElement) {
  return render(ui, { wrapper: Intl })
}

const intl = createIntl({ locale: 'en-US', messages: {}, onError: () => {} })

/** A message's default English text, formatted with its values (plurals too) */
export function text(
  message: { id?: string; defaultMessage: string },
  values: Record<string, string | number> = {}
) {
  return intl.formatMessage(
    {
      id: message.id ?? message.defaultMessage,
      defaultMessage: message.defaultMessage,
    },
    values
  )
}

/** A fetch answer */
export function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

import { defineMessages } from 'react-intl'

// Every message is declared here so the react builder can extract it.
// Messages it can't find statically slow down every page using the app.
export const messages = defineMessages({
  title: {
    id: 'store/recently-viewed.title',
    defaultMessage: 'Recently viewed',
  },
  editorTitle: {
    id: 'admin/editor.recently-viewed.title',
    defaultMessage: 'Recently viewed products',
  },
  editorShelfTitle: {
    id: 'admin/editor.recently-viewed.shelf-title',
    defaultMessage: 'Title',
  },
})

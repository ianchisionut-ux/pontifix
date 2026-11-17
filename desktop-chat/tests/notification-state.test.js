const test = require('node:test')
const assert = require('node:assert/strict')
const { freshMessages } = require('../notification-state')

test('shows each incoming message once', () => {
  const seen = new Set()
  const payload = { serverTime: '2026-11-17T10:00:00.000Z', items: [{ id: 'm1', senderName: 'Ioana', text: 'Salut' }] }
  assert.deepEqual(freshMessages(payload, seen)?.fresh, [{ id: 'm1', sender: 'Ioana', text: 'Salut' }])
  assert.deepEqual(freshMessages(payload, seen)?.fresh, [])
})

test('rejects invalid polling responses without advancing the cursor', () => {
  assert.equal(freshMessages({ serverTime: 'bad', items: [] }, new Set()), null)
  assert.equal(freshMessages({ serverTime: '2026-11-17T10:00:00Z' }, new Set()), null)
})

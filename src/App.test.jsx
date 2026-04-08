import React from 'react'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('hiển thị màn hình đăng nhập khi chưa đăng nhập', () => {
    render(<App />)
    expect(screen.getByLabelText(/Tài khoản/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mật khẩu/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đăng nhập/i })).toBeInTheDocument()
  })
})

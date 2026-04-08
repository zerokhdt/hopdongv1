import React from 'react'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { vi } from 'vitest'
import ContractView from './ContractView.jsx'
import userEvent from '@testing-library/user-event'

describe('ContractView', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user_branch', 'TRUNG MỸ TÂY')
    localStorage.setItem('user_role', 'user')
  })

  it('tài khoản chi nhánh không thấy cài template DOCX', async () => {
    await act(async () => {
      render(<ContractView userRole="user" employees={[]} onLogout={() => {}} />)
    })
    expect(screen.getByText(/Review/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chọn file DOCX/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dán Doc ID/i })).not.toBeInTheDocument()
  })


  it('tài khoản admin thấy cài template DOCX', async () => {
    await act(async () => {
      render(<ContractView userRole="admin" employees={[]} onLogout={() => {}} />)
    })
    expect(screen.getByText(/Review/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chọn file DOCX/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dán Doc ID/i })).toBeInTheDocument()
  })

  it('validate bắt buộc nhập Tạm trú', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    const employees = [{
      id: 'E001',
      name: 'Nguyễn Văn A',
      department: 'TRUNG MỸ TÂY',
      position: 'Giáo viên',
      phone: '0900000000',
      email: 'a@example.com',
      startDate: '2026-01-01',
      salary: '10000000',
      address: '1 Đường A',
      currentAddress: '2 Đường B',
      dob: '1990-01-01',
      cccd: '123456789012',
      cccd_date: '2010-01-01',
      cccd_place: 'TPHCM',
    }]

    await act(async () => {
      render(<ContractView userRole="user" employees={employees} onLogout={() => {}} />)
    })

    await user.click(screen.getByRole('button', { name: /Nguyễn Văn A/i }))
    const tamTru = screen.getByPlaceholderText(/Địa chỉ hiện tại/i)
    await user.clear(tamTru)
    await user.click(screen.getByRole('button', { name: /Xem trước/i }))
    expect(screen.getByText((txt, el) => el?.tagName?.toLowerCase() === 'p' && txt.includes('Tạm trú'))).toBeInTheDocument()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('validate bắt buộc nhập Đến ngày khi hợp đồng có thời hạn', async () => {
    localStorage.setItem('contract_type', 'thu-viec-ft')
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    const employees = [{
      id: 'E002',
      name: 'Trần Thị B',
      department: 'TRUNG MỸ TÂY',
      position: 'Giáo viên',
      phone: '0900000001',
      email: 'b@example.com',
      startDate: '2026-01-01',
      salary: '12000000',
      address: '1 Đường A',
      currentAddress: '2 Đường B',
      dob: '1992-01-01',
      cccd: '123456789013',
      cccd_date: '2012-01-01',
      cccd_place: 'TPHCM',
    }]

    await act(async () => {
      render(<ContractView userRole="user" employees={employees} onLogout={() => {}} />)
    })

    await user.click(screen.getByRole('button', { name: /Trần Thị B/i }))
    await user.click(screen.getByRole('button', { name: /Xem trước/i }))
    expect(screen.getByText((txt, el) => el?.tagName?.toLowerCase() === 'p' && txt.includes('Đến ngày'))).toBeInTheDocument()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })

  it('Ngày ký HĐ chỉ nhận dd/mm/yyyy', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    const employees = [{
      id: 'E003',
      name: 'Lê Văn C',
      department: 'TRUNG MỸ TÂY',
      position: 'Giáo viên',
      phone: '0900000002',
      email: 'c@example.com',
      startDate: '2026-01-01',
      salary: '13000000',
      address: '1 Đường A',
      currentAddress: '2 Đường B',
      dob: '1993-01-01',
      cccd: '123456789014',
      cccd_date: '2013-01-01',
      cccd_place: 'TPHCM',
    }]

    await act(async () => {
      render(<ContractView userRole="user" employees={employees} onLogout={() => {}} />)
    })

    await user.click(screen.getByRole('button', { name: /Lê Văn C/i }))
    const ngayKy = screen.getByPlaceholderText('dd/mm/yyyy')
    await user.clear(ngayKy)
    await user.type(ngayKy, '30-03-2026')
    await user.click(screen.getByRole('button', { name: /Xem trước/i }))
    expect(screen.getByText((txt, el) => el?.tagName?.toLowerCase() === 'p' && txt.includes('Ngày ký HĐ'))).toBeInTheDocument()
    expect(openSpy).not.toHaveBeenCalled()
    openSpy.mockRestore()
  })
})

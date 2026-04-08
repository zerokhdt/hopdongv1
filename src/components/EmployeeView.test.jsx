import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmployeeView from './EmployeeView.jsx'
import { importEmployeesFromCsv } from '../utils/employeeImport.js'

describe('EmployeeView', () => {
  it('tài khoản chi nhánh có thể chỉnh sửa lương/bhxh trong chi tiết nhân sự', async () => {
    const user = userEvent.setup()
    const employees = [
      {
        id: 'E001',
        name: 'Lê Ngọc Kim Anh',
        position: 'GVTTG',
        department: 'THỐNG NHẤT',
        email: 'ankim386@gmail.com',
        phone: '0869190549',
        startDate: '2022-05-09',
        salary: '10,000,000',
        hasInsurance: 'Có',
        insuranceAgency: 'BHXH TP.HCM',
        documentStatus: 'Đủ',
      },
    ]

    render(
      <EmployeeView
        employees={employees}
        setEmployees={() => {}}
        userRole="user"
        branchId="THỐNG NHẤT"
        movements={[]}
      />
    )

    await user.click(screen.getByTitle('Xem chi tiết'))
    const salaryInput = screen.getByPlaceholderText(/15,000,000/i)
    expect(salaryInput).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /LƯU THAY ĐỔI/i })).toBeInTheDocument()
  })

  it('import CSV chấp nhận header không dấu và dấu ;', () => {
    const csv = [
      'Ma NV;Ho Ten;Bo Phan;Vi Tri;Email;Dien Thoai',
      'E001;Nguyen Van A;TRUNG MY TAY;Giao vien;a@ace.edu.vn;0900000000',
    ].join('\n')
    const parsed = importEmployeesFromCsv(csv)
    expect(parsed.ok).toBe(true)
    expect(parsed.employees[0].id).toBe('E001')
    expect(parsed.employees[0].name).toBe('Nguyen Van A')
    expect(parsed.employees[0].department).toBe('TRUNG MY TAY')
  })
})

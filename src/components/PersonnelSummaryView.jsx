import React, { useMemo } from 'react';
import { Building2, Users, FileText, Download, Printer } from 'lucide-react';

export default function PersonnelSummaryView({ employees = [], branches = [] }) {
  const summaryData = useMemo(() => {
    return branches.map(branch => {
      const branchStaff = employees.filter(e => e.department === branch);
      
      const counts = {
        me: branchStaff.filter(e => 
          /Quản lý|QLCN|TBP|Văn phòng|NVCH|Chủ tịch|Giám đốc|Tổ trưởng|Head office|Chuyên viên/i.test(e.position)
        ).length,
        ime: branchStaff.filter(e => 
          /Giáo viên|GV|Trợ giảng|TA/i.test(e.position) && !/Thỉnh giảng|Part-time|Giao khoán/i.test(e.position)
        ).length,
        security: branchStaff.filter(e => /Bảo vệ/i.test(e.position)).length,
        cleaner: branchStaff.filter(e => /Tạp vụ|Lao công/i.test(e.position)).length,
        visiting: branchStaff.filter(e => /Thỉnh giảng|Part-time|Giao khoán/i.test(e.position)).length,
        other: 0,
        total: branchStaff.length
      };
      
      counts.other = counts.total - (counts.me + counts.ime + counts.security + counts.cleaner + counts.visiting);
      
      return {
        branch,
        ...counts
      };
    });
  }, [employees, branches]);

  const totals = useMemo(() => {
    return summaryData.reduce((acc, curr) => ({
      me: acc.me + curr.me,
      ime: acc.ime + curr.ime,
      security: acc.security + curr.security,
      cleaner: acc.cleaner + curr.cleaner,
      visiting: acc.visiting + curr.visiting,
      other: acc.other + curr.other,
      total: acc.total + curr.total
    }), { me: 0, ime: 0, security: 0, cleaner: 0, visiting: 0, other: 0, total: 0 });
  }, [summaryData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col bg-[#F2F4F7] p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tổng hợp nhân sự hệ thống</h2>
          <p className="text-slate-500 text-sm">Báo cáo số lượng nhân sự theo từng chi nhánh và bộ phận</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrint}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 font-bold text-sm shadow-sm"
          >
            <Printer size={18} /> In báo cáo
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all hover:bg-blue-700 font-bold text-sm shadow-sm">
            <Download size={18} /> Xuất Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 flex-1 flex flex-col overflow-hidden print:border-none print:shadow-none">
        <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-slate-300">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-yellow-400 text-slate-900 border-b-2 border-slate-800">
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-left w-12 border border-slate-800">STT</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-left border border-slate-800">CHI NHÁNH</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">ME (QL, TBP, VP)</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">IME (GV, TG CH)</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">BẢO VỆ</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">TẠP VỤ</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">GV THỈNH GIẢNG</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">KHÁC</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-center border border-slate-800 leading-tight">TỔNG CỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaryData.map((data, idx) => (
                <tr key={data.branch} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-bold text-slate-500 border border-slate-200">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-black text-slate-800 border border-slate-200 uppercase">{data.branch}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.me || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.ime || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.security || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.cleaner || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.visiting || '-'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-center border border-slate-200">{data.other || '-'}</td>
                  <td className="px-4 py-3 text-sm font-black text-center bg-slate-50 border border-slate-200">{data.total}</td>
                </tr>
              ))}
              <tr className="bg-yellow-400 font-black text-slate-900 sticky bottom-0 border-t-2 border-slate-800">
                <td colSpan="2" className="px-4 py-4 text-center border border-slate-800 uppercase tracking-widest">TỔNG HỆ THỐNG</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.me}</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.ime}</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.security}</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.cleaner}</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.visiting}</td>
                <td className="px-4 py-4 text-center border border-slate-800">{totals.other}</td>
                <td className="px-4 py-4 text-center border border-slate-800 text-lg">{totals.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

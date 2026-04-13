# Cấu trúc Excel import Trả góp

Hệ thống đọc:

- Chỉ sheet đầu tiên trong file.
- Dòng đầu tiên là tiêu đề cột.
- Các dòng sau là dữ liệu hợp đồng.

## Các cột được nhận diện

Có thể dùng đúng tên field hoặc tên tiếng Việt gần nghĩa. Các cột quan trọng nhất:

| Cột logic | Tiêu đề thường dùng |
| --- | --- |
| `stt` | `STT` |
| `loanDate` | `Ngày lên hợp đồng`, `Ngày`, `LoanDate` |
| `customerRef` | `Mã KH - Tên`, `Khách hàng`, `Tên KH` |
| `imei` | `IMEI` |
| `loanPackage` | `Gói vay` |
| `revenue` | `Doanh thu`, `Trả góp` |
| `setupFee` | `Phí cài máy` |
| `netDisbursement` | `Thực chi`, `Tiền đưa khách` |
| `paidBefore` | `Đóng trước` |
| `paymentDay` | `Ngày đóng`, `Ngày đóng trước` |
| `loanDays` | `Số ngày`, `Thời hạn`, `LoanTime` |
| `installmentAmount` | `Tiền đóng`, `Tiền đóng kỳ` |
| `note` | `Ghi chú`, `Note` |
| `installerName` | `NV cài đặt`, `Nhân viên cài đặt` |
| `referralFee` | `HH giới thiệu` |
| `mc` | `MC` |
| `status` | `Tình trạng`, `Status` |

## Quy tắc dữ liệu

- Ngày nhận các dạng: `dd/mm/yyyy`, `yyyy-mm-dd`, `yyyy/mm/dd`, hoặc serial date của Excel.
- Tiền nhận các dạng: `5000000`, `5.000.000`, `5,000,000`, `5.000.000 đ`.
- Hệ thống giữ nguyên đơn vị số tiền đúng như dữ liệu trong file Excel upload, không tự quy đổi đơn vị nghìn.
- Nếu không nhận diện được bất kỳ cột hợp lệ nào, import sẽ bị từ chối.
- Nếu tất cả các dòng dữ liệu đều không hợp lệ, import sẽ bị từ chối.

## Mẫu tối thiểu khuyến nghị

| STT | Ngày lên hợp đồng | Mã KH - Tên | Gói vay | Doanh thu | Số ngày | Tiền đóng | Ngày đóng | NV cài đặt | Tình trạng |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1 | 03/04/2026 | 5550001 Nguyễn Văn A | 5000000 | 6500000 | 30 | 216667 | 08/04/2026 | Nhân viên A | Đang theo dõi |

## Gợi ý import ổn định

- Nên luôn có các cột: `Ngày lên hợp đồng`, `Mã KH - Tên`, `Gói vay`, `Doanh thu`, `Số ngày`.
- Nếu import theo giao diện popup mới, nên chuẩn hóa thêm `Tiền đóng`, `Ngày đóng`, `NV cài đặt`, `Tình trạng`.
- Khi import cho màn mới, cần chọn đúng `shopId` trước khi bấm import vì toàn bộ file sẽ gắn vào một cửa hàng.

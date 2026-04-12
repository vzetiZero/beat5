#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the static HTML file
const staticHtmlPath = 'C:\\Users\\Administrator\\Desktop\\annam\\output\\site-single\\Installment\\Index\\body-clean.html';

// Read the file
let content = fs.readFileSync(staticHtmlPath, 'utf8');

// Check if tab already exists
if (content.includes('m_tab_denhanhthanhtoan')) {
  console.log('New tab already exists in static HTML');
  process.exit(0);
}

// Find the location to insert - look for the closing of m_tab_lichsu tab pane
const lichsuTabPattern = /<div class="tab-pane[^"]*" id="m_tab_lichsu">/;
const lichusuMatch = content.match(lichsuTabPattern);

if (!lichusuMatch) {
  console.log('Could not find m_tab_lichsu tab to use as reference');
  process.exit(1);
}

// Also need to add the tab button - find the nav-tabs section
const tabButtonPattern = /(<li class="nav-item m-tabs__item[^>]*" id="item_lichsu">.*?<\/li>)/;
const tabButtonMatch = content.match(tabButtonPattern);

if (!tabButtonMatch) {
  console.log('Could not find tab button section');
  process.exit(1);
}

// New tab button HTML
const newTabButton = `<li class="nav-item m-tabs__item m-nav" id="item_denhan"><a class="nav-link m-tabs__link" data-toggle="tab" href="#m_tab_denhanhthanhtoan"><img src="/public/assets/pay.svg" alt="Pay" style="width:16px; height:16px; margin-right:5px; vertical-align: middle;"/>Đến Hạn Thanh Toán</a></li>`;

// Insert tab button after item_lichsu
const updatedContent1 = content.replace(
  tabButtonMatch[0],
  tabButtonMatch[0] + newTabButton
);

// New tab pane HTML
const newTabPane = `<div class="tab-pane" id="m_tab_denhanhthanhtoan"><br><div><i class="m-portlet__head-text"><i class="fa fa-calendar"></i> Đến Hạn Thanh Toán</i></div><div class="m-form__seperator m-form__seperator--dashed m-form__seperator--space"></div><div class="alert alert-info" role="alert"><i class="la la-info-circle"></i> Danh sách các hợp đồng sắp đến hạn thanh toán hoặc đã quá hạn.</div><div class="table-responsive"><table id="tbl_DuePayment_list" class="table table-bordered m-table m-table--head-bg-gray table-hover"><thead><tr><th width="80px" class="text-center">STT</th><th class="text-center">Mã HĐ</th><th class="text-center">Khách hàng</th><th class="text-center">Ngày đến hạn</th><th class="text-center">Tiền còn phải đóng</th><th class="text-center">Trạng thái</th><th class="text-center">Thao tác</th></tr></thead><tbody id="duePmentTableBody"><tr><td colspan="7" class="text-center">Đang tải dữ liệu...</td></tr></tbody></table></div></div>`;

// Find where to insert the new tab pane - after the m_tab_lichsu closing tag
const tabPanePattern = /(<div class="tab-pane[^"]*" id="m_tab_lichsu">.*?<\/div>\s*<\/div>)/s;
const tabPaneMatch = updatedContent1.match(tabPanePattern);

if (!tabPaneMatch) {
  console.log('Could not find tab pane section');
  process.exit(1);
}

// Insert new tab pane after lichsu tab
const updatedContent2 = updatedContent1.replace(
  tabPaneMatch[1],
  tabPaneMatch[1] + newTabPane
);

// Write the updated content back
fs.writeFileSync(staticHtmlPath, updatedContent2, 'utf8');

console.log('Static HTML file updated successfully with new payment deadline tab');
process.exit(0);

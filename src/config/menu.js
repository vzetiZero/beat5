"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appNavItems = void 0;
exports.findMenuLink = findMenuLink;
exports.appNavItems = [
    {
        label: "Trả góp",
        href: "/Installment/Index/",
        icon: "flaticon-piggy-bank",
        permission: "installment",
        children: [
            {
                label: "Danh sách",
                href: "/Installment/Index/",
                icon: "flaticon-list-3"
            },
            {
                label: "Thêm mới",
                href: "/Installment/Create",
                icon: "flaticon-add"
            }
        ]
    },
    {
        label: "Cửa hàng",
        href: "/Shop/Index/",
        icon: "flaticon-imac",
        permission: "shop",
        children: [
            {
                label: "Danh sách",
                href: "/Shop/Index/",
                icon: "flaticon-list-3"
            },
            {
                label: "Thêm mới",
                href: "/Shop/Create",
                icon: "flaticon-add"
            }
        ]
    },
    {
        label: "Nhân viên",
        href: "/Staff/Index/",
        icon: "flaticon-users",
        permission: "staff",
        children: [
            {
                label: "Danh sách",
                href: "/Staff/Index/",
                icon: "flaticon-list-3"
            },
            {
                label: "Thêm mới",
                href: "/Staff/Create",
                icon: "flaticon-user-add"
            }
        ]
    },
    {
        label: "Phân quyền",
        href: "/Staff/PermissionStaff/",
        icon: "flaticon-lock",
        roles: ["admin"]
    },
    {
        label: "Lịch sử thao tác",
        href: "/History/",
        icon: "flaticon-time-2"
    },
    {
        label: "Thùng rác",
        href: "/Trash/Index/",
        icon: "flaticon-delete",
        roles: ["admin"]
    }
];
function findMenuLink(menus, controller, action) {
    for (const item of menus) {
        if (item.link === `/${controller}/${action}/`) {
            return item.link;
        }
        for (const child of item.children) {
            if (child.link === `/${controller}/${action}/`) {
                return child.link;
            }
        }
    }
    return null;
}

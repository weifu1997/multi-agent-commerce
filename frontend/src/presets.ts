import type { PresetProfile } from "./types";

export const PRESET_PROFILES: PresetProfile[] = [
  {
    id: "user_new",
    name: "新用户",
    badge: "初次访问",
    description: "无近30天消费记录，低客单偏好，少量基础配件浏览",
    context: {
      recent_views: ["耳机", "手机壳"],
      recent_purchases: [],
      view_count_7d: 3,
      purchase_count_30d: 0,
      avg_order_amount: 59.0,
      active_hours: [12, 19],
    },
  },
  {
    id: "user_vip",
    name: "高客单 VIP",
    badge: "高净值",
    description: "高客单价、近期频繁下单、专注旗舰手机与数码新品",
    context: {
      recent_views: ["折叠屏手机", "高端笔记本", "降噪耳机"],
      recent_purchases: ["智能手表", "平板电脑"],
      view_count_7d: 45,
      purchase_count_30d: 8,
      avg_order_amount: 3800.0,
      active_hours: [10, 14, 21],
    },
  },
  {
    id: "user_price",
    name: "价格敏感",
    badge: "性价比",
    description: "偏好高性价比实用配件，对价格与折扣敏感",
    context: {
      recent_views: ["快充数据线", "钢化贴膜", "手机支架"],
      recent_purchases: ["保护壳"],
      view_count_7d: 28,
      purchase_count_30d: 4,
      avg_order_amount: 69.0,
      active_hours: [11, 20, 23],
    },
  },
  {
    id: "user_churn",
    name: "流失风险",
    badge: "沉默用户",
    description: "近30天无消费，7天内仅偶发点击，召回挽留场景",
    context: {
      recent_views: ["充电宝"],
      recent_purchases: [],
      view_count_7d: 1,
      purchase_count_30d: 0,
      avg_order_amount: 120.0,
      active_hours: [22],
    },
  },
];

/** 2026/27 中文科組內非教學事務分工 — from 2026-2027_Chinese_Strict_Separated_Duty_Allocation.docx */
import type { DeptDutyYear } from './deptDutyTypes'

export const DEPT_DUTY_2627: DeptDutyYear = {
  startYear: 2026,
  label: '2026/27',
  source: '2026-2027_Chinese_Strict_Separated_Duty_Allocation.docx',
  items: [
    {
      id: 1,
      title: '週年計劃書及檢討報告',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      membersAll: true,
      members: [],
    },
    {
      id: 2,
      title: '財政預算報表',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
      ],
      members: [],
    },
    {
      id: 3,
      title: '教師專業發展',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      members: [],
    },
    {
      id: 4,
      title: 'TSA報告及數據',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
      ],
      members: [],
    },
    {
      id: 5,
      title: '校本課程',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      members: [
        { code: 'MYI', name: '葉銘欣' },
        { code: 'SMC', name: '朱小萌' },
        { code: 'KSM', name: '陳詩敏' },
        { code: 'LWT', name: '曾麗雲' },
        { code: 'LWW', name: '胡麗華' },
        { code: 'SHC', name: '周倩嫻' },
      ],
    },
    {
      id: 6,
      title: '校本評核小組 (SBA)',
      leaders: [
        { code: 'LWW', name: '胡麗華' },
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'MYI', name: '葉銘欣' },
      ],
      members: [],
    },
    {
      id: 7,
      title: '高小初中課程銜接',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      members: [
        { code: 'SMC', name: '朱小萌' },
      ],
    },
    {
      id: 8,
      title: '抽離式補課統籌組',
      leaders: [
        { code: 'SMC', name: '朱小萌', note: '拔尖-中六' },
        { code: 'MYI', name: '葉銘欣', note: '拔尖-中五' },
        { code: 'HKC', name: '陳曉君', note: '扶中' },
        { code: 'KSM', name: '陳詩敏', note: '補底' },
      ],
      members: [],
      memberGroups: [
        {
          label: '拔尖卷別',
          people: [
            { code: 'LWW', name: '胡麗華', note: '拔尖卷二乙' },
            { code: 'TWL', name: '梁芷蘊', note: '拔尖卷二甲' },
            { code: 'SMC', name: '朱小萌', note: '拔尖卷一乙' },
            { code: 'MYI', name: '葉銘欣', note: '拔尖卷一甲' },
          ],
        },
        {
          label: '上學期',
          people: [
            { code: 'TWL', name: '梁芷蘊', note: '12D' },
            { code: 'MYI', name: '葉銘欣', note: '12S' },
            { code: 'HKC', name: '陳曉君', note: '12G' },
            { code: 'LWW', name: '胡麗華', note: '12P' },
            { code: 'KSM', name: '陳詩敏', note: '12M' },
            { code: 'YLN', name: '吳綺琳', note: '12L' },
            { code: 'WKL', name: '王家朗', note: '12T' },
            { code: 'HNY', name: '袁軒妮', note: '12J' },
          ],
        },
        {
          label: '下學期',
          people: [
            { code: 'LKL', name: '林麗君', note: '11G' },
            { code: 'SMC', name: '朱小萌', note: '11P' },
            { code: 'LWT', name: '曾麗雲', note: '11M' },
            { code: 'KIC', name: '朱麒穎', note: '11L' },
            { code: 'SHC', name: '周倩嫻', note: '11J' },
            { code: 'LL', name: '李寶玲', note: '11T' },
            { code: 'CHUC', name: '陳振翔', note: '11A' },
          ],
        },
      ],
    },
    {
      id: 9,
      title: '朗誦訓練組',
      leaders: [
        { code: 'SMC', name: '朱小萌' },
      ],
      members: [
        { code: 'LKL', name: '林麗君' },
        { code: 'CC', name: '鄭媛媛' },
        { code: 'LL', name: '李寶玲' },
        { code: 'KSM', name: '陳詩敏' },
        { code: 'FYC', name: '朱鳳儀' },
        { code: 'LWT', name: '曾麗雲' },
        { code: 'HNY', name: '袁軒妮' },
        { code: 'WKL', name: '王家朗' },
        { code: 'THW', name: '黃子軒' },
        { code: 'CHUC', name: '陳振翔' },
        { code: 'YCN', name: '吳燕青' },
        { code: 'HKC', name: '陳曉君' },
        { code: 'SHC', name: '周倩嫻' },
        { code: 'KYL', name: '黎嘉茵' },
      ],
    },
    {
      id: 10,
      title: '廣泛閱讀計劃',
      leaders: [
        { code: 'YLN', name: '吳綺琳' },
      ],
      members: [
        { code: 'KIC', name: '朱麒穎' },
      ],
    },
    {
      id: 11,
      title: '問卷調查及效能評估',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      members: [
        { code: 'LWT', name: '曾麗雲', note: 'G7' },
        { code: 'LL', name: '李寶玲', note: 'G8' },
        { code: 'MYI', name: '葉銘欣', note: 'G9' },
        { code: 'SMC', name: '朱小萌', note: 'G10' },
        { code: 'LWW', name: '胡麗華', note: 'G11' },
        { code: 'HKC', name: '陳曉君', note: 'G12' },
      ],
    },
    {
      id: 12,
      title: '初中中文網網上閱讀',
      leaders: [
        { code: 'LKL', name: '林麗君' },
      ],
      members: [
        { code: 'HT', name: '盧曉彤' },
      ],
    },
    {
      id: 13,
      title: '文集出版組',
      leaders: [
        { code: 'LWT', name: '曾麗雲' },
      ],
      members: [
        { code: 'LL', name: '李寶玲' },
        { code: 'THW', name: '黃子軒' },
        { code: 'CHUC', name: '陳振翔' },
        { code: 'YCN', name: '吳燕青' },
        { code: 'FYC', name: '朱鳳儀' },
        { code: 'KYL', name: '黎嘉茵' },
      ],
    },
    {
      id: 14,
      title: '集思組',
      leaders: [
        { code: 'HNY', name: '袁軒妮' },
        { code: 'KSM', name: '陳詩敏' },
      ],
      members: [
        { code: 'CHUC', name: '陳振翔' },
        { code: 'YCN', name: '吳燕青' },
        { code: 'KYL', name: '黎嘉茵' },
      ],
    },
    {
      id: 15,
      title: '文憑試 (DSE) 支援組',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'MYI', name: '葉銘欣' },
      ],
      members: [
        { code: 'HKC', name: '陳曉君' },
      ],
    },
    {
      id: 16,
      title: '辯論學會',
      leaders: [
        { code: 'WKL', name: '王家朗' },
        { code: 'SMC', name: '朱小萌' },
      ],
      members: [],
    },
    {
      id: 17,
      title: '資訊科技 (IT) 支援組',
      leaders: [
        { code: 'WKL', name: '王家朗' },
      ],
      members: [
        { code: 'HT', name: '盧曉彤' },
      ],
    },
    {
      id: 18,
      title: '資源表編輯',
      leaders: [
        { code: 'HT', name: '盧曉彤' },
      ],
      members: [],
    },
    {
      id: 19,
      title: '級講座 / 考察 / 活動',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
      ],
      members: [
        { code: 'LWT', name: '曾麗雲' },
        { code: 'LL', name: '李寶玲' },
        { code: 'MYI', name: '葉銘欣' },
        { code: 'SMC', name: '朱小萌' },
        { code: 'LWW', name: '胡麗華' },
        { code: 'HKC', name: '陳曉君' },
        { code: 'KSM', name: '陳詩敏', note: 'EC' },
      ],
    },
    {
      id: 20,
      title: 'AI 教學研發',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
      ],
      members: [
        { code: 'SHC', name: '周倩嫻' },
        { code: 'YLN', name: '吳綺琳' },
        { code: 'KSM', name: '陳詩敏' },
        { code: 'KIC', name: '朱麒穎' },
      ],
    },
    {
      id: 21,
      title: 'BYOD 教學研發',
      leaders: [
        { code: 'LKL', name: '林麗君' },
        { code: 'SMC', name: '朱小萌' },
      ],
      members: [
        { code: 'LWT', name: '曾麗雲', note: 'G7' },
        { code: 'LL', name: '李寶玲', note: 'G8' },
        { code: 'MYI', name: '葉銘欣', note: 'G9' },
      ],
    },
    {
      id: 22,
      title: '交流團組',
      leaders: [
        { code: 'CC', name: '鄭媛媛' },
        { code: 'MYI', name: '葉銘欣' },
      ],
      members: [
        { code: 'TCM', name: '馬太初' },
      ],
    },
    {
      id: 23,
      title: '比賽統籌組',
      leaders: [
        { code: 'SHC', name: '周倩嫻' },
        { code: 'HNY', name: '袁軒妮' },
      ],
      members: [
        { code: 'HT', name: '盧曉彤' },
      ],
    },
    {
      id: 24,
      title: '中文學會',
      leaders: [
        { code: 'MYI', name: '葉銘欣' },
        { code: 'TWL', name: '梁芷蘊' },
        { code: 'LKL', name: '林麗君' },
        { code: 'SHC', name: '周倩嫻' },
      ],
      members: [],
    },
    {
      id: 25,
      title: '校園美化小組',
      leaders: [
        { code: 'TWL', name: '梁芷蘊' },
      ],
      members: [
        { code: 'CC', name: '鄭媛媛' },
        { code: 'FYC', name: '朱鳳儀' },
        { code: 'YLN', name: '吳綺琳' },
        { code: 'KIC', name: '朱麒穎' },
        { code: 'TCM', name: '馬太初' },
      ],
    },
  ],
  teachers: [
    {
      code: 'TWL',
      name: '梁芷蘊',
      title: '高中級科主任',
      lines: [
        { itemId: 1, title: '週年計劃書及檢討報告', role: 'leader' },
        { itemId: 2, title: '財政預算報表', role: 'leader' },
        { itemId: 3, title: '教師專業發展', role: 'leader' },
        { itemId: 4, title: 'TSA報告及數據', role: 'leader' },
        { itemId: 5, title: '校本課程', role: 'leader' },
        { itemId: 7, title: '高小初中課程銜接', role: 'leader' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'leader' },
        { itemId: 15, title: '文憑試 (DSE) 支援組', role: 'leader' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'leader' },
        { itemId: 20, title: 'AI 教學研發', role: 'leader' },
        { itemId: 25, title: '校園美化小組', role: 'leader' },
        { itemId: 6, title: '校本評核小組 (SBA)', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '拔尖卷二甲/上學期12D' },
        { itemId: 24, title: '中文學會', role: 'leader' },
      ],
    },
    {
      code: 'LKL',
      name: '林麗君',
      title: '初中級科主任',
      lines: [
        { itemId: 12, title: '初中中文網網上閱讀', role: 'leader' },
        { itemId: 1, title: '週年計劃書及檢討報告', role: 'leader' },
        { itemId: 3, title: '教師專業發展', role: 'leader' },
        { itemId: 5, title: '校本課程', role: 'leader' },
        { itemId: 21, title: 'BYOD 教學研發', role: 'leader' },
        { itemId: 7, title: '高小初中課程銜接', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '下學期11G' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'leader' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'leader' },
        { itemId: 24, title: '中文學會', role: 'leader' },
      ],
    },
    {
      code: 'MYI',
      name: '葉銘欣',
      title: '高中級副科主任',
      lines: [
        { itemId: 6, title: '校本評核小組 (SBA)', role: 'leader' },
        { itemId: 5, title: '校本課程', role: 'member' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'leader', note: '中五拔尖統籌 / 卷一甲 / 上學期12S' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G9負責' },
        { itemId: 15, title: '文憑試 (DSE) 支援組', role: 'leader' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
        { itemId: 21, title: 'BYOD 教學研發', role: 'member', note: 'G9負責' },
        { itemId: 24, title: '中文學會', role: 'leader' },
        { itemId: 22, title: '交流團組', role: 'leader' },
      ],
    },
    {
      code: 'SMC',
      name: '朱小萌',
      title: '初中級副科主任',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'leader', note: '中六拔尖 / 卷一乙' },
        { itemId: 9, title: '朗誦訓練組', role: 'leader' },
        { itemId: 21, title: 'BYOD 教學研發', role: 'leader' },
        { itemId: 5, title: '校本課程', role: 'member' },
        { itemId: 7, title: '高小初中課程銜接', role: 'member' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G10負責' },
        { itemId: 16, title: '辯論學會', role: 'leader' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
      ],
    },
    {
      code: 'SHC',
      name: '周倩嫻',
      lines: [
        { itemId: 23, title: '比賽統籌組', role: 'leader' },
        { itemId: 5, title: '校本課程', role: 'member' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '下學期11J' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 20, title: 'AI 教學研發', role: 'member' },
        { itemId: 24, title: '中文學會', role: 'leader' },
      ],
    },
    {
      code: 'LWW',
      name: '胡麗華',
      lines: [
        { itemId: 6, title: '校本評核小組 (SBA)', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '拔尖卷二乙 / 上學期12P' },
        { itemId: 5, title: '校本課程', role: 'member' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G11負責' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
      ],
    },
    {
      code: 'HKC',
      name: '陳曉君',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'leader', note: '扶中 / 上學期12G' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G12負責' },
        { itemId: 15, title: '文憑試 (DSE) 支援組', role: 'member' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
      ],
    },
    {
      code: 'KSM',
      name: '陳詩敏',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'leader', note: '補底 / 上學期12M' },
        { itemId: 5, title: '校本課程', role: 'member' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 14, title: '集思組', role: 'leader' },
        { itemId: 20, title: 'AI 教學研發', role: 'member' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member', note: 'EC' },
      ],
    },
    {
      code: 'LWT',
      name: '曾麗雲',
      lines: [
        { itemId: 13, title: '文集出版組', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '下學期11M' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G7負責' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
        { itemId: 21, title: 'BYOD 教學研發', role: 'member', note: 'G7負責' },
      ],
    },
    {
      code: 'LL',
      name: '李寶玲',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '下學期11T' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 11, title: '問卷調查及效能評估', role: 'member', note: 'G8負責' },
        { itemId: 13, title: '文集出版組', role: 'member' },
        { itemId: 19, title: '級講座 / 考察 / 活動', role: 'member' },
        { itemId: 21, title: 'BYOD 教學研發', role: 'member', note: 'G8負責' },
      ],
    },
    {
      code: 'WKL',
      name: '王家朗',
      lines: [
        { itemId: 16, title: '辯論學會', role: 'leader' },
        { itemId: 17, title: '資訊科技 (IT) 支援組', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '上學期12T' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
      ],
    },
    {
      code: 'THW',
      name: '黃子軒',
      title: 'THW',
      lines: [
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 13, title: '文集出版組', role: 'member' },
      ],
    },
    {
      code: 'YLN',
      name: '吳綺琳',
      lines: [
        { itemId: 10, title: '廣泛閱讀計劃', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '上學期12L' },
        { itemId: 20, title: 'AI 教學研發', role: 'member' },
        { itemId: 25, title: '校園美化小組', role: 'member' },
      ],
    },
    {
      code: 'KIC',
      name: '朱麒穎',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'leader', note: '初中 / 下學期11L' },
        { itemId: 10, title: '廣泛閱讀計劃', role: 'member' },
        { itemId: 20, title: 'AI 教學研發', role: 'member' },
        { itemId: 25, title: '校園美化小組', role: 'member' },
      ],
    },
    {
      code: 'HNY',
      name: '袁軒妮',
      lines: [
        { itemId: 14, title: '集思組', role: 'leader' },
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '上學期12J' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 23, title: '比賽統籌組', role: 'leader' },
      ],
    },
    {
      code: 'CC',
      name: '鄭媛媛',
      lines: [
        { itemId: 22, title: '交流團組', role: 'leader' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 25, title: '校園美化小組', role: 'member' },
      ],
    },
    {
      code: 'TCM',
      name: '馬太初',
      lines: [
        { itemId: 22, title: '交流團組', role: 'member' },
        { itemId: 25, title: '校園美化小組', role: 'member' },
      ],
    },
    {
      code: 'CHUC',
      name: '陳振翔',
      lines: [
        { itemId: 8, title: '抽離式補課統籌組', role: 'member', note: '下學期11A' },
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 13, title: '文集出版組', role: 'member' },
        { itemId: 14, title: '集思組', role: 'member' },
      ],
    },
    {
      code: 'YCN',
      name: '吳燕青',
      lines: [
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 13, title: '文集出版組', role: 'member' },
        { itemId: 14, title: '集思組', role: 'member' },
      ],
    },
    {
      code: 'FYC',
      name: '朱鳳儀',
      lines: [
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 13, title: '文集出版組', role: 'member' },
        { itemId: 25, title: '校園美化小組', role: 'member' },
      ],
    },
    {
      code: 'KYL',
      name: '黎嘉茵',
      lines: [
        { itemId: 9, title: '朗誦訓練組', role: 'member' },
        { itemId: 13, title: '文集出版組', role: 'member' },
        { itemId: 14, title: '集思組', role: 'member' },
      ],
    },
    {
      code: 'HT',
      name: '盧曉彤',
      title: '教學助理',
      lines: [
        { itemId: 18, title: '資源表編輯', role: 'leader' },
        { itemId: 12, title: '初中中文網網上閱讀', role: 'member' },
        { itemId: 17, title: '資訊科技 (IT) 支援組', role: 'member' },
        { itemId: 23, title: '比賽統籌組', role: 'member' },
      ],
    },
  ],
}

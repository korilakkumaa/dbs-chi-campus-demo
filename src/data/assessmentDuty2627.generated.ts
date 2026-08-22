/** Auto-generated from 2026-2027_Chinese_Assessment_Duty.xlsx — 2026/27. Do not edit by hand. */
import type { AssessmentDutyYear } from './assessmentDutyTypes'

export const ASSESSMENT_DUTY_2627: AssessmentDutyYear = {
  startYear: 2026,
  label: '2026/27',
  title: '2026-2027年度 中文科各級考核擬題與分工',
  categoryLabels: {
    phaseTest: "階段性統測",
    paper1: "卷一：閱讀能力",
    paper2: "卷二：寫作能力",
    listeningSba: "聆聽評估 / SBA 校本評核",
    makeupSpecial: "學年補考 / 專項分班試",
  },
  categoryShortLabels: {
    phaseTest: "統測",
    paper1: "卷一",
    paper2: "卷二",
    listeningSba: "聆聽/SBA",
    makeupSpecial: "補考/專項",
  },
  gradeMatrix: [
    {
      gradeLabel: "中一 (G7)",
      gradeShort: "中一",
      categories: {
        phaseTest: [
          { semester: "first", part: null, note: null, teacherCode: "FYC", weight: 0.5 },
          { semester: "second", part: null, note: null, teacherCode: "THW", weight: 0.5 },
        ],
        paper1: [
          { semester: "first", part: null, note: null, teacherCode: "HNY", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "YLN", weight: 1 },
        ],
        paper2: [
          { semester: "first", part: null, note: null, teacherCode: "YLN", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "THW", weight: 1 },
        ],
        listeningSba: [
          { semester: "both", part: null, note: "聆聽", teacherCode: "HT", weight: null },
        ],
        makeupSpecial: [
          { semester: "year", part: null, note: "分班試", teacherCode: "LKL", weight: 1 },
        ],
      },
    },
    {
      gradeLabel: "中二 (G8)",
      gradeShort: "中二",
      categories: {
        phaseTest: [
          { semester: "first", part: null, note: null, teacherCode: "CHUC", weight: 0.5 },
          { semester: "second", part: null, note: null, teacherCode: "KYL", weight: 0.5 },
        ],
        paper1: [
          { semester: "first", part: null, note: null, teacherCode: "KSM", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "CHUC", weight: 1 },
        ],
        paper2: [
          { semester: "first", part: null, note: null, teacherCode: "TCM", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "LL", weight: 1 },
        ],
      },
    },
    {
      gradeLabel: "中三 (G9)",
      gradeShort: "中三",
      categories: {
        phaseTest: [
          { semester: "first", part: null, note: null, teacherCode: "YCN", weight: 0.5 },
          { semester: "second", part: null, note: null, teacherCode: "SMC", weight: 0.5 },
        ],
        paper1: [
          { semester: "first", part: null, note: null, teacherCode: "THW", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "YCN", weight: 1 },
        ],
        paper2: [
          { semester: "first", part: "甲", note: null, teacherCode: "THW", weight: 0.5 },
          { semester: "first", part: "乙", note: null, teacherCode: "CC", weight: 1.5 },
          { semester: "second", part: "甲", note: null, teacherCode: "CC", weight: 0.5 },
          { semester: "second", part: "乙", note: null, teacherCode: "HKC", weight: 1.5 },
        ],
        makeupSpecial: [
          { semester: "year", part: null, note: "TSA", teacherCode: "MYI", weight: 0.5 },
        ],
      },
    },
    {
      gradeLabel: "中四 (G10)",
      gradeShort: "中四",
      categories: {
        phaseTest: [
          { semester: "first", part: "甲乙", note: null, teacherCode: "KIC", weight: 1 },
          { semester: "second", part: "甲乙", note: null, teacherCode: "KSM", weight: 1 },
        ],
        paper1: [
          { semester: "first", part: "甲", note: null, teacherCode: "YCN", weight: 0.5 },
          { semester: "first", part: "乙", note: null, teacherCode: "FYC", weight: 1 },
          { semester: "second", part: "甲", note: null, teacherCode: "KIC", weight: 0.5 },
          { semester: "second", part: "乙", note: null, teacherCode: "SMC", weight: 1 },
        ],
        paper2: [
          { semester: "first", part: "甲", note: null, teacherCode: "KYL", weight: 1 },
          { semester: "first", part: "乙", note: null, teacherCode: "SHC", weight: 1 },
          { semester: "first", part: null, note: null, teacherCode: "YCN", weight: 0.5 },
          { semester: "second", part: "甲", note: null, teacherCode: "FYC", weight: 1 },
          { semester: "second", part: "乙", note: null, teacherCode: "KYL", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "SHC", weight: 0.5 },
        ],
      },
    },
    {
      gradeLabel: "中五 (G11)",
      gradeShort: "中五",
      categories: {
        phaseTest: [
          { semester: "first", part: "甲乙", note: null, teacherCode: "LL", weight: 1 },
          { semester: "second", part: "甲乙", note: null, teacherCode: "LWT", weight: 1 },
        ],
        paper1: [
          { semester: "first", part: "甲", note: null, teacherCode: "LL", weight: 0.5 },
          { semester: "first", part: "乙", note: null, teacherCode: "LKL", weight: 1 },
          { semester: "second", part: "甲", note: null, teacherCode: "KSM", weight: 0.5 },
          { semester: "second", part: "乙", note: null, teacherCode: "LWT", weight: 1 },
        ],
        paper2: [
          { semester: "first", part: "甲", note: null, teacherCode: "SMC", weight: 1 },
          { semester: "first", part: "乙", note: null, teacherCode: "CHUC", weight: 1 },
          { semester: "first", part: null, note: null, teacherCode: "LWT", weight: 0.5 },
          { semester: "second", part: "甲", note: null, teacherCode: "SHC", weight: 1 },
          { semester: "second", part: "乙", note: null, teacherCode: "MYI", weight: 1 },
          { semester: "second", part: null, note: null, teacherCode: "KIC", weight: 0.5 },
        ],
        listeningSba: [
          { semester: "first", part: null, note: "SBA文", teacherCode: "LWW", weight: 1.5 },
          { semester: "first", part: null, note: null, teacherCode: "TWL", weight: 0.5 },
          { semester: "second", part: null, note: "SBA口", teacherCode: "TWL", weight: 0.5 },
          { semester: "second", part: null, note: null, teacherCode: "MYI", weight: 0.5 },
        ],
      },
    },
    {
      gradeLabel: "中六 (G12)",
      gradeShort: "中六",
      categories: {
        phaseTest: [
          { semester: "first", part: "甲乙", note: null, teacherCode: "HNY", weight: 1 },
        ],
        paper1: [
          { semester: "mock", part: "甲", note: null, teacherCode: "YLN", weight: 0.5 },
          { semester: "mock", part: "乙", note: null, teacherCode: "HKC", weight: 1 },
        ],
        paper2: [
          { semester: "mock", part: "甲", note: null, teacherCode: "MYI", weight: 1 },
          { semester: "mock", part: "乙", note: null, teacherCode: "LWW", weight: 1 },
          { semester: "mock", part: null, note: null, teacherCode: "TWL", weight: 0.5 },
        ],
        listeningSba: [
          { semester: "year", part: null, note: "Post-Mock", teacherCode: "TWL", weight: 1 },
        ],
      },
    },
    {
      gradeLabel: "學年補考階段",
      gradeShort: "補考",
      categories: {
        makeupSpecial: [
          { semester: "year", part: null, note: "初中擬", teacherCode: "LKL", weight: 0.5 },
          { semester: "year", part: null, note: "初中改", teacherCode: "WKL", weight: 0.25 },
          { semester: "year", part: null, note: "高中擬", teacherCode: "TWL", weight: 0.5 },
          { semester: "year", part: null, note: "高中改", teacherCode: "WKL", weight: 0.25 },
        ],
      },
    },
  ],
  teachers: [
    {
      name: "王家朗",
      code: "WKL",
      firstSemester: [
        { ec: true, grade: "中一", task: "卷一", weight: null },
        { ec: true, grade: "中一", task: "卷二", weight: null },
        { ec: true, grade: "中四", task: "卷一", weight: null },
        { ec: true, grade: "中四", task: "卷二", weight: null },
      ],
      secondSemester: [
        { ec: true, grade: "中一", task: "卷一", weight: null },
        { ec: true, grade: "中一", task: "卷二", weight: null },
        { ec: true, grade: "中三", task: "卷一", weight: null },
        { ec: true, grade: "中三", task: "卷二", weight: null },
        { ec: true, grade: "中四", task: "卷一", weight: null },
        { ec: true, grade: "中四", task: "卷二", weight: null },
        { ec: false, grade: "初中", task: "補考閱", weight: 0.25 },
        { ec: false, grade: "高中", task: "補考閱", weight: 0.25 },
      ],
      totalWeight: 0.5,
      workloadTier: 'low',
    },
    {
      name: "周倩嫻",
      code: "SHC",
      firstSemester: [
        { ec: false, grade: "中四", task: "卷二·乙", weight: 1 },
        { ec: true, grade: "中二", task: "卷一", weight: null },
      ],
      secondSemester: [
        { ec: false, grade: "中五", task: "卷二·甲", weight: 1 },
        { ec: false, grade: "中四", task: "卷二·乙", weight: 0.5 },
        { ec: true, grade: "中二", task: "卷二", weight: null },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "胡麗華",
      code: "LWW",
      firstSemester: [
        { ec: false, grade: "中五", task: "SBA文", weight: 1.5 },
        { ec: true, grade: "中二", task: "卷二", weight: null },
      ],
      secondSemester: [
        { ec: false, grade: "中六", task: "卷二·乙", weight: 1 },
        { ec: true, grade: "中二", task: "卷一", weight: null },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "陳詩敏",
      code: "KSM",
      firstSemester: [
        { ec: false, grade: "中二", task: "卷一", weight: 1 },
        { ec: true, grade: "中三", task: "卷二", weight: null },
      ],
      secondSemester: [
        { ec: false, grade: "中四", task: "統測", weight: 1 },
        { ec: false, grade: "中五", task: "卷一·甲", weight: 0.5 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "吳綺琳",
      code: "YLN",
      firstSemester: [
        { ec: false, grade: "中一", task: "卷二", weight: 1 },
        { ec: false, grade: "中六", task: "卷一·甲", weight: 0.5 },
        { ec: true, grade: "中三", task: "卷二", weight: null },
      ],
      secondSemester: [
        { ec: false, grade: "中一", task: "卷一", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "梁芷蘊",
      code: "TWL",
      firstSemester: [
        { ec: false, grade: "中五", task: "SBA文", weight: 0.5 },
        { ec: false, grade: "中六", task: "卷二·乙", weight: 0.5 },
        { ec: false, grade: "中六", task: "Post-Mock", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中五", task: "SBA口", weight: 0.5 },
        { ec: false, grade: "高中", task: "補考", weight: 0.5 },
      ],
      totalWeight: 3,
      workloadTier: 'high',
    },
    {
      name: "林麗君",
      code: "LKL",
      firstSemester: [
        { ec: false, grade: "中五", task: "卷一·乙", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中一", task: "分班試", weight: 1 },
        { ec: false, grade: "初中", task: "補考", weight: 0.5 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "曾麗雲",
      code: "LWT",
      firstSemester: [
        { ec: false, grade: "中五", task: "卷二·乙", weight: 0.5 },
      ],
      secondSemester: [
        { ec: false, grade: "中五", task: "統測", weight: 1 },
        { ec: false, grade: "中五", task: "卷一·乙", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "朱麒穎",
      code: "KIC",
      firstSemester: [
        { ec: false, grade: "中四", task: "統測", weight: 1 },
        { ec: false, grade: "中三", task: "卷二·甲", weight: 0.5 },
      ],
      secondSemester: [
        { ec: false, grade: "中四", task: "卷一·甲", weight: 0.5 },
        { ec: false, grade: "中五", task: "卷二·乙", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "朱鳳儀",
      code: "FYC",
      firstSemester: [
        { ec: false, grade: "中一", task: "統測", weight: 0.5 },
        { ec: false, grade: "中四", task: "卷一·乙", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中四", task: "卷二·甲", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "吳燕青",
      code: "YCN",
      firstSemester: [
        { ec: false, grade: "中三", task: "統測", weight: 0.5 },
        { ec: false, grade: "中四", task: "卷一·甲", weight: 0.5 },
        { ec: false, grade: "中四", task: "卷二·乙", weight: 0.5 },
      ],
      secondSemester: [
        { ec: false, grade: "中三", task: "卷一", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "陳振翔",
      code: "CHUC",
      firstSemester: [
        { ec: false, grade: "中二", task: "統測", weight: 0.5 },
        { ec: false, grade: "中五", task: "卷二·乙", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中二", task: "卷一", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "袁軒妮",
      code: "HNY",
      firstSemester: [
        { ec: false, grade: "中六", task: "統測", weight: 1 },
        { ec: false, grade: "中一", task: "卷一", weight: 1 },
      ],
      secondSemester: [
      ],
      totalWeight: 2,
      workloadTier: 'moderate',
    },
    {
      name: "葉銘欣",
      code: "MYI",
      firstSemester: [
        { ec: false, grade: "中六", task: "卷二·甲", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中五", task: "卷二·乙", weight: 1 },
        { ec: false, grade: "中五", task: "SBA口", weight: 0.5 },
        { ec: false, grade: "中三", task: "TSA", weight: 0.5 },
      ],
      totalWeight: 3,
      workloadTier: 'high',
    },
    {
      name: "李寶玲",
      code: "LL",
      firstSemester: [
        { ec: false, grade: "中五", task: "統測", weight: 1 },
        { ec: false, grade: "中五", task: "卷一·甲", weight: 0.5 },
      ],
      secondSemester: [
        { ec: false, grade: "中二", task: "卷二", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "陳曉君",
      code: "HKC",
      firstSemester: [
        { ec: false, grade: "中六", task: "卷一·乙", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中三", task: "卷二·乙", weight: 1.5 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "朱小萌",
      code: "SMC",
      firstSemester: [
        { ec: false, grade: "中五", task: "卷二·甲", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中三", task: "統測", weight: 0.5 },
        { ec: false, grade: "中四", task: "卷一·乙", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "黃子軒",
      code: "THW",
      firstSemester: [
        { ec: false, grade: "中三", task: "卷一", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中一", task: "統測", weight: 0.5 },
        { ec: false, grade: "中一", task: "卷二", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "黎嘉茵",
      code: "KYL",
      firstSemester: [
        { ec: false, grade: "中四", task: "卷二·甲", weight: 1 },
      ],
      secondSemester: [
        { ec: false, grade: "中二", task: "統測", weight: 0.5 },
        { ec: false, grade: "中四", task: "卷二·乙", weight: 1 },
      ],
      totalWeight: 2.5,
      workloadTier: 'medium',
    },
    {
      name: "鄭媛媛",
      code: "CC",
      firstSemester: [
        { ec: false, grade: "中三", task: "卷二·乙", weight: 1.5 },
      ],
      secondSemester: [
        { ec: false, grade: "中三", task: "卷二·甲", weight: 0.5 },
      ],
      totalWeight: 2,
      workloadTier: 'moderate',
    },
    {
      name: "盧曉彤",
      code: "HT",
      firstSemester: [
        { ec: false, grade: "中一至中三", task: "聆聽", weight: null },
      ],
      secondSemester: [
        { ec: false, grade: "中一至中三", task: "聆聽", weight: null },
      ],
      totalWeight: null,
      workloadTier: 'none',
    },
    {
      name: "馬太初",
      code: "TCM",
      firstSemester: [
        { ec: false, grade: "中二", task: "卷二", weight: 1 },
      ],
      secondSemester: [
      ],
      totalWeight: 1,
      workloadTier: 'low',
    },
  ],
  ecAppendix: [
    {
      grade: "中一",
      firstPaper1: "WKL",
      firstPaper2: "WKL",
      secondPaper1: "WKL",
      secondPaper2: "WKL",
    },
    {
      grade: "中二",
      firstPaper1: "SHC",
      firstPaper2: "LWW",
      secondPaper1: "LWW",
      secondPaper2: "SHC",
    },
    {
      grade: "中三",
      firstPaper1: "YLN",
      firstPaper2: "KSM",
      secondPaper1: "WKL",
      secondPaper2: "WKL",
    },
    {
      grade: "中四",
      firstPaper1: "WKL",
      firstPaper2: "WKL",
      secondPaper1: "WKL",
      secondPaper2: "WKL",
    },
  ],
}

const fs = require("fs");
import {
  dirs,
  kensa,
  soudan,
  hasseijoukyou,
  summaryType,
  fileType
} from "./types";
import { CONST_KENSA, CONST_SOUDAN, CONST_HASSEI } from "./const";
import { buildJsonPath, setLabelFromDateStr } from "./utils";
import { openLocalFiles } from "./openLocalFiles";
/**
 * This is an optional script. It creates a JSON file that's following format of the following file:
 * https://github.com/tokyo-metropolitan-gov/covid19/blob/master/data/data.json
 *
 * Reference:
 * - https://docs.google.com/spreadsheets/d/1PWwV2bn9N9C2Cfox9-KdXDryIkRPh6LEpbXVZsAfwwM/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/1SzMw0_Kg4MJJmgafq0NUeYEKdxAiyvPT_wWxWl-zrNw/edit#gid=0
 */

type summary = {
  json: (kensa & soudan & hasseijoukyou)[];
  path: string;
  type: fileType;
};

function calcByStatus(json: hasseijoukyou[], status: string): number {
  return json.reduce((acc, row: hasseijoukyou) => {
    if (row.status === status) {
      acc++;
    }
    return acc;
  }, 0);
}

async function mapper(resAll: summary[], dirs: dirs): Promise<void> {
  // Mapping multiple data into data.json
  const [soudanJson] = resAll
    .filter((res) => res.type === CONST_SOUDAN)
    .map((res) => res.json);
  const [kensaJson] = resAll
    .filter((res) => res.type === CONST_KENSA)
    .map((res) => res.json);
  const [hasseijoukyouJson] = resAll
    .filter((res) => res.type === CONST_HASSEI)
    .map((res) => res.json);
  const dataBasedOnSoudan = buildDataBySoudan(soudanJson);
  const dataBasedOnKensa = buildDataByKensa(kensaJson);
  const dataBasedOnHassei = buildDataByHasseiAndKensa(
    hasseijoukyouJson,
    kensaJson
  );

  const [currentDataItem] = await openLocalFiles([
    buildJsonPath("data.json", dirs.dist || "")
  ]);
  const currentData = currentDataItem ? JSON.parse(currentDataItem) || {} : {};
  const mappedJson = {
    ...currentData,
    ...dataBasedOnSoudan,
    ...dataBasedOnKensa,
    ...dataBasedOnHassei
  };

  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(
        buildJsonPath("data.json", dirs.dist || ""),
        JSON.stringify(mappedJson, null, 2)
      );
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function addDate1(date: Date) {
  date.setDate(date.getDate() + 1);
}

function buildDataByKensa(kensaJson: kensa[]) {
  return kensaJson
    ? {
        inspections: {
          date: setLabelFromDateStr(
            kensaJson[kensaJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: kensaJson.map((row) => {
            const dateToLabel = setLabelFromDateStr(row.date, "");
            return {
              判明日: dateToLabel("判明日"),
              検査検体数: row.num_total,
              疑い例検査: 0,
              接触者調査: 0,
              陰性確認: 0,
              "（小計①）": row.num_total,
              チャーター便: 0,
              クルーズ船: 0,
              陰性確認2: 0,
              "（小計②）": 0,
              nagano_date_label: row.date
            };
          })
        },
        inspections_summary: {
          date: setLabelFromDateStr(
            kensaJson[kensaJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: {
            県内: kensaJson.map((row) => {
              return Number(row.num_total);
            }),
            その他: kensaJson.map(() => 0),
            labels: kensaJson.map((row) => {
              return setLabelFromDateStr(row.date, row.date)("short_date");
            })
          }
        },
        patients_summary: {
          date: setLabelFromDateStr(
            kensaJson[kensaJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: kensaJson.map((row) => {
            const dateToLabel = setLabelFromDateStr(row.date, "");
            return {
              日付: dateToLabel("日付"),
              小計: row.positive,
              positive: row.positive,
              negative: row.negative,
              total: row.num_total
            };
          })
        },
        lastUpdate: setLabelFromDateStr(
          kensaJson[kensaJson.length - 1].date,
          "",
          addDate1
        )("reportDate")
      }
    : {};
}

function buildDataBySoudan(soudanJson: soudan[]) {
  return soudanJson
    ? {
        contacts: {
          date: setLabelFromDateStr(
            soudanJson[soudanJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: soudanJson
            .filter((row) => row.date)
            .map((row) => {
              const dateToLabel = setLabelFromDateStr(row.date, "");
              return {
                日付: dateToLabel("日付"),
                曜日: dateToLabel("曜日"),
                "9-13時": 0,
                "13-17時": 0,
                "17-21時": 0,
                date: dateToLabel("yyyy-mm-dd"),
                w: dateToLabel("w"),
                short_date: dateToLabel("short_date"),
                小計: row.num_total,
                nagano_date_label: row.date
              };
            })
        }
      }
    : {};
}

function buildDataByHasseiAndKensa(
  hasseijoukyouJson: hasseijoukyou[],
  kensaJson: kensa[]
) {
  return hasseijoukyouJson && kensaJson
    ? {
        patients: {
          date: setLabelFromDateStr(
            kensaJson[kensaJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: hasseijoukyouJson.map((row: hasseijoukyou) => {
            const dateToLabel = setLabelFromDateStr(row.date, "");
            return {
              リリース日: dateToLabel("日付"),
              曜日: dateToLabel("w"),
              居住地: row.area,
              年代: row.age_group,
              性別: row.gender,
              退院: row.status === "退院" ? "〇" : null,
              date: dateToLabel("yyyy-mm-dd")
            };
          })
        },
        discharges_summary: {
          date: setLabelFromDateStr(
            kensaJson[kensaJson.length - 1].date,
            "",
            addDate1
          )("reportDate"),
          data: (function (): summaryType[] {
            const hasseiMap = new Map();
            hasseijoukyouJson
              .filter((row: hasseijoukyou) => row.status === "退院")
              .forEach((row: hasseijoukyou) => {
                const val = hasseiMap.get(row.date);
                if (val) {
                  hasseiMap.set(row.date, val + 1);
                } else {
                  hasseiMap.set(row.date, 1);
                }
              });
            const hasseiArray: summaryType[] = [];
            hasseiMap.forEach((val, key) => {
              hasseiArray.push({
                日付: <string>setLabelFromDateStr(key, "")("日付"),
                小計: val
              });
            });
            return hasseiArray.sort((a, b) => {
              if (a.日付 > b.日付) return 1;
              if (a.日付 < b.日付) return -1;
              return 0;
            });
          })()
        },
        main_summary: {
          attr: "検査実施人数",
          value: kensaJson.reduce((acc: number, row) => {
            return acc + (Number(row.num_total) || 0);
          }, 0),
          children: [
            {
              attr: "陽性患者数",
              value: hasseijoukyouJson.length,
              children: [
                {
                  attr: "入院中",
                  value: calcByStatus(hasseijoukyouJson, "入院中")
                },
                {
                  attr: "退院",
                  value: calcByStatus(hasseijoukyouJson, "退院")
                },
                {
                  attr: "死亡",
                  value: calcByStatus(hasseijoukyouJson, "死亡")
                }
              ]
            }
          ]
        }
      }
    : {};
}

export { mapper };

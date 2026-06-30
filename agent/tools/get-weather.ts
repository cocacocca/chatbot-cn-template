/** @file EVE 工具：根据坐标或城市名称查询当前天气，依赖 open-meteo 的地理编码与天气 API。 */
import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * 通过城市名称查询其经纬度坐标。
 * 调用 open-meteo 的 geocoding API，返回首个匹配结果。
 *
 * @param city 城市名称
 * @returns 包含 latitude / longitude 的对象；查询失败或无结果时返回 null
 */
async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 无匹配结果
    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch (err) {
    // 网络或解析异常时返回 null，由调用方处理
    console.error("[get-weather] geocode failed:", err);
    return null;
  }
}

/**
 * get_weather EVE 工具。
 * 工具用途：查询指定位置的当前天气，支持通过城市名称或经纬度坐标定位。
 *
 * 输入 schema：
 * - latitude: 纬度（可选）
 * - longitude: 经度（可选）
 * - city: 城市名称（可选，与坐标二选一）
 *
 * 返回值：open-meteo forecast API 的原始 JSON 数据；
 * 若入参同时提供了 city，则返回数据中附加 cityName 字段；
 * 入参缺失或城市无法定位时返回包含 error 字段的对象。
 */
export default defineTool({
  description:
    "Get the current weather at a location. You can provide either coordinates or a city name.",
  inputSchema: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    city: z
      .string()
      .describe("City name (e.g., 'San Francisco', 'New York', 'London')")
      .optional(),
  }),
  async execute({ latitude, longitude, city }, _ctx) {
    let lat: number;
    let lon: number;

    // 优先使用城市名称进行地理编码
    if (city) {
      const coords = await geocodeCity(city);
      if (!coords) {
        return {
          error: `Could not find coordinates for "${city}". Please check the city name.`,
        };
      }
      lat = coords.latitude;
      lon = coords.longitude;
    } else if (latitude !== undefined && longitude !== undefined) {
      // 直接使用入参坐标
      lat = latitude;
      lon = longitude;
    } else {
      // 既未提供城市也未提供完整坐标
      return {
        error:
          "Please provide either a city name or both latitude and longitude coordinates.",
      };
    }

    // 调用 open-meteo forecast API 获取天气数据
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
    );

    const weatherData = await response.json();

    // 入参含 city 时，在返回数据中附加城市名称
    if (city) {
      weatherData.cityName = city;
    }

    return weatherData;
  },
});

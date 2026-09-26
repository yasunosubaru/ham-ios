/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2026/9/27
 */
import {getWeather, LUOJIA_CAMPUS} from './api';
import {WeatherApiError, parseWeather} from './parser';
import type {
  WeatherCondition,
  WeatherDay,
  WeatherNow,
  WeatherReport,
} from './type';

export {getWeather, LUOJIA_CAMPUS, WeatherApiError, parseWeather};
export type {WeatherCondition, WeatherDay, WeatherNow, WeatherReport};

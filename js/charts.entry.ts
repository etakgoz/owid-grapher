// CSS

import 'font-awesome/css/font-awesome.css'
import '../css/chart.scss'

// Enable mobx-formatters
const Mobx = require('mobx')
const mobxFormatters = require('mobx-formatters').default
mobxFormatters(Mobx)
//Mobx.useStrict(true)

import Grapher from './charts/Grapher'
import ChartView from './charts/ChartView'
declare var window: any
window.Grapher = Grapher
window.ChartView = ChartView

import Debug from './charts/Debug'
Debug.expose()

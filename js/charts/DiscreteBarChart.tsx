import * as React from 'react'
import { select } from 'd3-selection'
import { sortBy, some, min, max } from './Util'
import { computed, autorun, runInAction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import AxisScale from './AxisScale'
import Color from './Color'
import HorizontalAxis, { HorizontalAxisView } from './HorizontalAxis'
import { AxisGridLines } from './AxisBox'
import NoData from './NoData'

export interface DiscreteBarDatum {
    key: string
    value: number
    year: number
    label: string
    color: Color
    formatValue: (value: number) => string
}

@observer
export default class DiscreteBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get chart() { return this.props.chart }
    @computed.struct get bounds() { return this.props.bounds.padRight(10) }

    @computed get failMessage() {
        return this.chart.discreteBar.failMessage
    }

    @computed get data() {
        return this.chart.discreteBar.data
    }

    @computed get legendFontSize() {
        return 0.85*this.props.chart.baseFontSize
    }

    // Account for the width of the legend
    @computed get legendWidth() {
        const longestLabel = sortBy(this.data, d => -d.label.length)[0].label
        return Bounds.forText(longestLabel, { fontSize: this.legendFontSize }).width
    }

    // Account for the width of the little value labels at the end of bars
    @computed get endLabelFontSize() {
        return 0.75*this.props.chart.baseFontSize
    }

    @computed get hasPositive() {
        return this.data.some(d => d.value >= 0)
    }

    @computed get hasNegative() {
        return this.data.some(d => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed get rightEndLabelWidth(): number {
        if (this.hasPositive) {
            const positiveLabels = this.data.filter(d => d.value >= 0).map(d => this.barValueFormat(d))
            const longestPositiveLabel = sortBy(positiveLabels, l => -l.length)[0]
            return Bounds.forText(longestPositiveLabel, { fontSize: this.endLabelFontSize }).width
        } else {
            return 0
        }
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed get leftEndLabelWidth(): number {
        if (this.hasNegative) {
            const negativeLabels = this.data.filter(d => d.value < 0).map(d => this.barValueFormat(d))
            const longestNegativeLabel = sortBy(negativeLabels, l => -l.length)[0]
            return Bounds.forText(longestNegativeLabel, { fontSize: this.endLabelFontSize }).width + 10
        } else {
            return 0
        }
    }

    // Now we can work out the main x axis scale
    @computed get xDomainDefault(): [number, number] {
        const allValues = this.data.map(d => d.value)
        const minX = Math.min(0, min(allValues) as number)
        const maxX = max(allValues) as number
        return [minX, maxX]
    }

    @computed get xRange() {
        return [this.bounds.left + this.legendWidth + this.leftEndLabelWidth, this.bounds.right - this.rightEndLabelWidth]
    }

    @computed get xScale() {
        const xAxis = this.chart.yAxis.toSpec({ defaultDomain: this.xDomainDefault }) // XXX
        return new AxisScale(xAxis).extend({
            domain: this.xDomainDefault,
            range: this.xRange,
            tickFormat: this.chart.discreteBar.tickFormat
        })
    }

    @computed get xAxis() {
        const that = this
        return new HorizontalAxis({
            get scale() { return that.xScale },
            get fontSize() { return that.chart.baseFontSize }
        })
    }

    @computed get innerBounds() {
        return this.bounds.padLeft(this.legendWidth + this.leftEndLabelWidth).padBottom(this.xAxis.height).padRight(this.rightEndLabelWidth)
    }

    @computed get barHeight() {
        return 0.8 * this.innerBounds.height / this.data.length
    }

    @computed get barSpacing() {
        return (this.innerBounds.height / this.data.length) - this.barHeight
    }

    @computed get barPlacements() {
        const { data, xScale } = this
        return data.map(d => {
            const isNegative = d.value < 0
            const barX = isNegative ? xScale.place(d.value) : xScale.place(0)
            const barWidth = isNegative ? xScale.place(0) - barX : xScale.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => {
            if (this.failMessage) return

            const widths = this.barPlacements.map(b => b.width)
            runInAction(() => {
                const bars = select(this.base.current).selectAll("g.bar > rect")
                bars.attr('width', 0).transition().attr('width', (_, i) => widths[i])
            })
        })
    }

    componentWillUnmount() {
        this.dispose()
    }

    @computed get barValueFormat() {
        return this.chart.discreteBar.barValueFormat
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const { data, bounds, legendWidth, xAxis, xScale, innerBounds, barHeight, barSpacing, endLabelFontSize, barValueFormat } = this

        let yOffset = innerBounds.top + barHeight / 2

        return <g ref={this.base} className="DiscreteBarChart">
            <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} opacity={0} fill="rgba(255,255,255,0)" />
            <HorizontalAxisView bounds={bounds} axis={xAxis} />
            <AxisGridLines orient="bottom" scale={xScale} bounds={innerBounds} />
            {data.map(d => {
                const isNegative = d.value < 0
                const barX = isNegative ? xScale.place(d.value) : xScale.place(0)
                const barWidth = isNegative ? xScale.place(0) - barX : xScale.place(d.value) - barX

                const result = <g className="bar">
                    <text x={bounds.left + legendWidth - 5} y={yOffset} fill="#666" dominantBaseline="middle" textAnchor="end" fontSize={endLabelFontSize}>{d.label}</text>
                    <rect x={barX} y={yOffset - barHeight / 2} width={barWidth} height={barHeight} fill={d.color} opacity={0.85} />
                    <text x={xScale.place(d.value) + (isNegative ? -5 : 5)} y={yOffset} fill="#666" dominantBaseline="middle" textAnchor={isNegative ? "end" : "start"} fontSize={endLabelFontSize}>{barValueFormat(d)}</text>
                </g>
                yOffset += barHeight + barSpacing
                return result
            })}
        </g>
    }
}

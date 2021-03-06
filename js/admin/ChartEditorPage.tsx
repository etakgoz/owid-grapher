import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, runInAction, autorun, action, reaction, IReactionDisposer} from 'mobx'
import { Prompt, Redirect } from 'react-router-dom'

import ChartView from '../charts/ChartView'
import Bounds from '../charts/Bounds'
import {includes, capitalize} from '../charts/Util'
import ChartConfig from '../charts/ChartConfig'

import ChartEditor, {EditorDatabase, Log} from './ChartEditor'
import EditorBasicTab from './EditorBasicTab'
import EditorDataTab from './EditorDataTab'
import EditorTextTab from './EditorTextTab'
import EditorCustomizeTab from './EditorCustomizeTab'
import EditorScatterTab from './EditorScatterTab'
import EditorMapTab from './EditorMapTab'
import EditorHistoryTab from './EditorHistoryTab'
import SaveButtons from './SaveButtons'
import { LoadingBlocker } from './Forms'
import AdminLayout from './AdminLayout'
import { AdminAppContext } from './AdminAppContext'

@observer
class TabBinder extends React.Component<{ editor: ChartEditor }> {
    dispose!: IReactionDisposer
    componentDidMount() {
        //window.addEventListener("hashchange", this.onHashChange)
        this.onHashChange()

        this.dispose = autorun(() => {
            const tab = this.props.editor.tab
            //setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
        })
    }

    componentWillUnmount() {
        //window.removeEventListener("hashchange", this.onHashChange)
        this.dispose()
    }

    render() {
        return null
    }

    @action.bound onHashChange() {
        const match = window.location.hash.match(/#(.+?)-tab/)
        if (match) {
            const tab = match[1]
            if (this.props.editor.chart && includes(this.props.editor.availableTabs, tab))
                this.props.editor.tab = tab
        }
    }
}

@observer
export default class ChartEditorPage extends React.Component<{ chartId?: number, newChartIndex?: number, chartConfig?: any }> {
    @observable.ref chart?: ChartConfig
    @observable.ref database?: EditorDatabase
    @observable logs?: Log[]
    static contextType = AdminAppContext

    async fetchChart() {
        const {chartId, chartConfig} = this.props
        const {admin} = this.context
        const json = chartId === undefined ? chartConfig : await admin.getJSON(`/api/charts/${chartId}.config.json`)
        runInAction(() => this.chart = new ChartConfig(json))
    }

    async fetchData() {
        const {admin} = this.context
        const json = await admin.getJSON(`/api/editorData/namespaces.json`)
        runInAction(() => this.database = new EditorDatabase(json))
    }

    async fetchLogs() {
        const { chartId } = this.props
        const { admin } = this.context
        const json = chartId === undefined ? [] : await admin.getJSON(`/api/charts/${chartId}.logs.json`)
        runInAction(() => this.logs = json.logs)
    }

    @computed get editor(): ChartEditor|undefined {
        if (this.chart === undefined || this.database === undefined) {
            return undefined
        } else {
            const that = this
            return new ChartEditor({
                get admin() { return that.context.admin },
                get chart() { return that.chart as ChartConfig },
                get database() { return that.database as EditorDatabase },
                get logs() { return that.logs as Log[] }
            })
        }
    }

    @action.bound refresh() {
        this.fetchChart()
        this.fetchData()
        this.fetchLogs()
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.refresh()

        this.dispose = reaction(
            () => this.editor && this.editor.previewMode,
            () => {
                if (this.editor) {
                    localStorage.setItem('editorPreviewMode', this.editor.previewMode)
                }
            }
        )
    }

    // This funny construction allows the "new chart" link to work by forcing an update
    // even if the props don't change
    componentWillReceiveProps() {
        setTimeout(() => this.refresh(), 0)
    }

    componentWillUnmount() {
        this.dispose()
    }

    render() {
        return <AdminLayout noSidebar>
            <main className="ChartEditorPage">
                {(this.editor === undefined || this.editor.currentRequest) && <LoadingBlocker/>}
                {this.editor !== undefined && this.renderReady(this.editor)}
            </main>
        </AdminLayout>
    }

    renderReady(editor: ChartEditor) {
        const {chart, availableTabs, previewMode} = editor

        return <React.Fragment>
            {!editor.newChartId && <Prompt when={editor.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>}
            {editor.newChartId && <Redirect to={`/charts/${editor.newChartId}/edit`}/>}
            <TabBinder editor={editor}/>
            <form onSubmit={e => e.preventDefault()}>
                <div className="p-2">
                    <ul className="nav nav-tabs">
                        {availableTabs.map(tab =>
                            <li key={tab} className="nav-item">
                                <a className={"nav-link" + (tab === editor.tab ? " active" : "")} onClick={() => editor.tab = tab}>{capitalize(tab)}</a>
                            </li>
                        )}
                    </ul>
                </div>
                <div className="innerForm container">
                    {editor.tab === 'basic' && <EditorBasicTab editor={editor} />}
                    {editor.tab === 'text' && <EditorTextTab editor={editor} />}
                    {editor.tab === 'data' && <EditorDataTab editor={editor} />}
                    {editor.tab === 'customize' && <EditorCustomizeTab editor={editor} />}
                    {editor.tab === 'scatter' && <EditorScatterTab chart={chart} />}
                    {editor.tab === 'map' && <EditorMapTab editor={editor} />}
                    {editor.tab === 'revisions' && <EditorHistoryTab editor={editor} />}
                </div>
                <SaveButtons editor={editor} />
            </form>
            <div>
                <figure data-grapher-src>
                    {<ChartView chart={chart} bounds={previewMode === "mobile" ? new Bounds(0, 0, 360, 500) : new Bounds(0, 0, 800, 600)}/>}
                    {/*<ChartView chart={chart} bounds={new Bounds(0, 0, 800, 600)}/>*/}
                </figure>
                <div className="btn-group" data-toggle="buttons">
                    <label className={"btn btn-light" + (previewMode === "mobile" ? " active" : "")} title="Mobile preview">
                        <input type="radio" onChange={action(_ => editor.previewMode = 'mobile')} name="previewSize" id="mobile" checked={previewMode === "mobile"}/>
                        <i className="fa fa-mobile"/>
                    </label>
                    <label className={"btn btn-light" + (previewMode === "desktop" ? " active" : "")} title="Desktop preview">
                        <input onChange={action(_ => editor.previewMode = 'desktop')} type="radio" name="previewSize" id="desktop" checked={previewMode === "desktop"}/>
                        <i className="fa fa-desktop"/>
                    </label>
                </div>
            </div>
        </React.Fragment>

    }
}

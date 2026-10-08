import streamlit as st
import pydeck as pdk
import plotly.graph_objects as go
import os
import sys

# Ensure app is in path
sys.path.append(os.path.dirname(__file__))
from data import get_simulated_data, get_chart_data

st.set_page_config(page_title="POSEIDON", layout="wide", initial_sidebar_state="collapsed")

# Inject Custom CSS
css_path = os.path.join(os.path.dirname(__file__), "styles.css")
with open(css_path) as f:
    st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# Initialize Session State
if 'selected_zone' not in st.session_state:
    st.session_state.selected_zone = 'BUNDER'
if 'time_val' not in st.session_state:
    st.session_state.time_val = 14

zones = get_simulated_data(st.session_state.time_val)

# TOP STRIP
st.markdown("""
<div class="top-strip">
    <div class="top-strip-left">POSEIDON | MANGALURU COASTAL SECTOR</div>
    <div class="top-strip-right">
        <span class="mono" style="color: #6FB7D6;">SIM TIME: {}:00</span>
        <span class="bg-high">STATUS: 3 ZONES HIGH OR SEVERE / PEAK 16:10 / 2 HOSPITALS THREATENED</span>
    </div>
</div>
""".format(st.session_state.time_val), unsafe_allow_html=True)

# MAIN LAYOUT
col_map, col_panel = st.columns([65, 35])

with col_map:
    # PyDeck Map
    layer = pdk.Layer(
        "ScatterplotLayer",
        data=zones,
        get_position="[lon, lat]",
        get_radius="[peak_depth * 1500 + 300]",
        get_fill_color="color",
        pickable=True,
        stroked=True,
        get_line_color=[215, 224, 230, 200],
        line_width_min_pixels=1,
    )
    
    view_state = pdk.ViewState(latitude=12.88, longitude=74.84, zoom=11.5, pitch=0)
    
    # Custom HTML Tooltip matching CSS
    tooltip = {
        "html": "<div style='font-family: \"IBM Plex Sans\", sans-serif; background-color: #151D23; border: 1px solid #243039; padding: 8px; font-size: 12px;'>"
                "<b style='color: #D7E0E6;'>{name}</b><br/>"
                "<span style='color: #7C8A94;'>PROBABILITY:</span> <span class='mono'>{p_flood}</span><br/>"
                "<span style='color: #7C8A94;'>ONSET:</span> <span class='mono'>{onset}</span> | "
                "<span style='color: #7C8A94;'>PEAK:</span> <span class='mono'>{peak}</span>"
                "</div>",
        "style": {"backgroundColor": "transparent", "padding": "0"}
    }
    
    r = pdk.Deck(
        layers=[layer], 
        initial_view_state=view_state, 
        map_style="mapbox://styles/mapbox/dark-v10",
        tooltip=tooltip
    )
    st.pydeck_chart(r, use_container_width=True)

with col_panel:
    st.markdown('<div class="panel">', unsafe_allow_html=True)
    tab1, tab2, tab3 = st.tabs(["ALERTS", "RESPONSE ORDER", "WHY"])
    
    with tab1:
        st.markdown('<div class="panel-header">ACTIVE ZONE ALERTS</div>', unsafe_allow_html=True)
        # Sort by severity (descending depth) then onset
        alerts = zones[zones['peak_depth'] > 0.1].sort_values(['peak_depth', 'onset_hr'], ascending=[False, True])
        
        for _, row in alerts.iterrows():
            st.markdown(f"""
            <div class="alert-row">
                <div>
                    <div class="alert-meta">
                        <span style="font-weight: 600;">{row['name']}</span>
                        <span class="{row['css_class']}">{row['severity']}</span>
                        <span class="text-muted">onset <span class="mono">{row['onset']}</span></span>
                        <span class="text-muted">peak <span class="mono">{row['peak']}</span></span>
                    </div>
                    <div class="alert-desc">{row['drivers']}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
    with tab2:
        st.markdown('<div class="panel-header">DISPATCH PRIORITY</div>', unsafe_allow_html=True)
        rpi_list = zones[zones['rpi'] > 0].sort_values('rpi', ascending=False).reset_index()
        
        st.markdown('<ol class="response-list">', unsafe_allow_html=True)
        for i, row in rpi_list.iterrows():
            st.markdown(f"""
            <li class="response-item">
                <div class="response-number">{i+1}</div>
                <div class="response-content">
                    <span style="font-weight: 600;">{row['name']}</span> <span class="text-muted mono">RPI:{row['rpi']:.1f}</span><br/>
                    <span style="color: #D7E0E6;">Affected: {row['facilities']}</span>
                </div>
            </li>
            """, unsafe_allow_html=True)
        st.markdown('</ol>', unsafe_allow_html=True)
        
    with tab3:
        st.markdown('<div class="panel-header">PREDICTION DRIVERS</div>', unsafe_allow_html=True)
        zone_sel = st.selectbox("Select Zone", zones['name'].tolist(), label_visibility="collapsed")
        row = zones[zones['name'] == zone_sel].iloc[0]
        
        st.markdown(f"""
        <p><b>{row['name']}</b></p>
        <p class="text-muted" style="margin-bottom: 16px !important;">
        This zone has a <span class="mono">{row['p_flood']:.0%}</span> chance of flooding. 
        Water will likely reach the street by <span class="mono">{row['onset']}</span> and peak at <span class="mono">{row['peak_depth']:.1f}m</span>.
        Uncertainty range on peak is ±0.2m.
        </p>
        <p><b>Primary Drivers</b></p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Rainfall Intensity</span><span class="mono">85%</span></div>
                <div style="width: 100%; background: #243039; height: 6px;"><div style="width: 85%; background: #6FB7D6; height: 100%;"></div></div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Tide Blocking</span><span class="mono">60%</span></div>
                <div style="width: 100%; background: #243039; height: 6px;"><div style="width: 60%; background: #6FB7D6; height: 100%;"></div></div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Elevation</span><span class="mono">45%</span></div>
                <div style="width: 100%; background: #243039; height: 6px;"><div style="width: 45%; background: #6FB7D6; height: 100%;"></div></div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown('</div>', unsafe_allow_html=True)

# BOTTOM ROW: Timeline Scrubber & Chart
st.markdown("<hr/>", unsafe_allow_html=True)
col_slide, col_chart = st.columns([30, 70])

with col_slide:
    st.markdown("<div style='padding-top: 24px;'>", unsafe_allow_html=True)
    new_time = st.slider("TIMELINE (HOURS)", 0, 24, st.session_state.time_val, label_visibility="visible")
    st.markdown("</div>", unsafe_allow_html=True)
    if new_time != st.session_state.time_val:
        st.session_state.time_val = new_time
        st.rerun()

with col_chart:
    chart_df = get_chart_data()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=chart_df['time'], y=chart_df['rain'], name='Rain (mm)', line=dict(color='#6FB7D6', width=1)))
    fig.add_trace(go.Scatter(x=chart_df['time'], y=chart_df['tide']*20, name='Tide', line=dict(color='#D7E0E6', width=1, dash='dot')))
    fig.add_vline(x=st.session_state.time_val, line_width=1, line_dash="solid", line_color="#E07B39")
    
    fig.update_layout(
        height=100, 
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        showlegend=False,
        xaxis=dict(showgrid=False, zeroline=False, color='#7C8A94', tickfont=dict(family='IBM Plex Mono', size=10)),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False)
    )
    st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': False})

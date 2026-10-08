import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_household_verdict(zone_pred, road_impact, building_impact, needs_assistance=False):
    """
    Household leave-now advisor (F14).
    Verdict logic:
    - Leave now / Leave by hh:mm
    - Safe to wait, re-check at hh:mm
    - Route cut, move upstairs
    """
    p_flood = zone_pred['p_flood']
    peak_depth = zone_pred['peak_depth_p50']
    onset_hr = zone_pred['onset_30cm_hr']
    
    # We look at the specific building and road for the household
    b_flooded = building_impact['is_flooded']
    r_closure_hr = road_impact['closure_hr']
    r_closed = road_impact['is_closed']
    
    # Safety buffer
    buffer_hrs = 2.0 if needs_assistance else 1.0
    
    if p_flood < 0.3 or not b_flooded:
        return {
            'verdict': 'SAFE TO WAIT',
            'message': 'Low risk of ground floor flooding. Re-check in 4 hours.',
            'leave_by': None
        }
        
    # If high probability of flooding
    if r_closed:
        if r_closure_hr > 0: # It closes in the future
            leave_by = max(0, r_closure_hr - buffer_hrs)
            
            # If leave_by is in the past or 0 (meaning now)
            if leave_by <= 0:
                return {
                    'verdict': 'LEAVE NOW',
                    'message': 'Your route is closing imminently.',
                    'leave_by': 'Immediate'
                }
            else:
                return {
                    'verdict': f'LEAVE BY Hour {leave_by:.1f}',
                    'message': 'Your ground floor will flood and roads will become impassable.',
                    'leave_by': leave_by
                }
        else:
            # Already closed
            return {
                'verdict': 'ROUTE CUT. MOVE UPSTAIRS',
                'message': 'Do not attempt to travel through floodwater. Move to a higher floor.',
                'leave_by': None
            }
            
    # Default fallback
    return {
        'verdict': 'ADVISORY',
        'message': 'Monitor conditions closely.',
        'leave_by': None
    }

if __name__ == "__main__":
    z = {'p_flood': 0.8, 'peak_depth_p50': 0.5, 'onset_30cm_hr': 4.0}
    b = {'is_flooded': True}
    r = {'is_closed': True, 'closure_hr': 3.0}
    
    print(generate_household_verdict(z, r, b))

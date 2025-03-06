class HandleBlocks {
    public static getIncludeBlockInfo(id: bigint) {
      return {
        blocked_users_blocked_users_blocked_user_idTousers: {
          // To know if the user is blocking the specific person
          where: { blocking_user_id: id },
        },
        blocked_users_blocked_users_blocking_user_idTousers: {
          // To know if the user is blocking the specific person
          where: { blocked_user_id: id },
        },
      };
    }

    public static checkIsBlocked(res: any) {
        // Hide results that the user has blocked
        if(res.blocked_users_blocked_users_blocked_user_idTousers.length != 0) {return true;}
        // Hide results that have blocked the user
        if(res.blocked_users_blocked_users_blocking_user_idTousers.length != 0) {return true;}
        return false;
    }
}
export default HandleBlocks;